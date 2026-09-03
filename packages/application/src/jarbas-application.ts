import { randomUUID } from "node:crypto";

import type {
  ChatRequest,
  ChatMessage,
  ChatStreamEvent,
  ComponentHealth,
  JarbasConfig,
  LlmProvider,
  MessageRecord,
  ModelRoute,
  ProviderHealth,
  RequestMetricRecord,
  SessionRecord,
  SystemHealth,
  TokenUsage
} from "@jarvis/contracts";

import type { ContextWindowManager } from "./context-window-manager.js";
import {
  InputContextLimitError,
  InvalidChatRequestError,
  ProviderUnavailableError,
  SessionBusyError,
  SessionNotFoundError
} from "./errors.js";
import type {
  ApplicationLogger,
  ModelRouteResolver,
  SessionStorePort
} from "./ports.js";

export class JarbasApplication {
  private readonly activeSessions = new Set<string>();

  public constructor(
    private readonly config: JarbasConfig,
    private readonly store: SessionStorePort,
    private readonly providers: ReadonlyMap<string, LlmProvider>,
    private readonly logger: ApplicationLogger,
    private readonly router: ModelRouteResolver,
    private readonly contextWindow: ContextWindowManager
  ) {}

  public createSession(
    projectId = "inbox",
    title = "Nova conversa"
  ): SessionRecord {
    return this.store.createSession(projectId, title);
  }

  public getSession(id: string): SessionRecord | undefined {
    return this.store.getSession(id);
  }

  public listMessages(sessionId: string): readonly MessageRecord[] {
    return this.store.listMessages(sessionId);
  }

  public async *chat(
    request: ChatRequest,
    signal?: AbortSignal
  ): AsyncIterable<ChatStreamEvent> {
    if (!request.content.trim()) {
      throw new InvalidChatRequestError("Message content cannot be empty");
    }
    if (!this.store.getSession(request.sessionId)) {
      throw new SessionNotFoundError();
    }

    const route = this.router.route(request.task ?? "simple_conversation");
    const provider = this.providers.get(route.providerId);
    if (!provider) throw new ProviderUnavailableError(route.providerId);
    if (this.activeSessions.has(request.sessionId)) {
      throw new SessionBusyError();
    }

    this.activeSessions.add(request.sessionId);
    try {
      yield* this.executeTurn(request, route, provider, signal);
    } finally {
      this.activeSessions.delete(request.sessionId);
    }
  }

  private async *executeTurn(
    request: ChatRequest,
    route: ModelRoute,
    provider: LlmProvider,
    signal?: AbortSignal
  ): AsyncIterable<ChatStreamEvent> {
    const requestId = randomUUID();
    const candidateMessages: ChatMessage[] = [
      ...this.store
        .listMessages(request.sessionId)
        .filter(({ role }) => role === "user" || role === "assistant")
        .map(({ role, content }) => ({ role, content })),
      { role: "user", content: request.content }
    ];
    const context = this.contextWindow.select(
      candidateMessages,
      route.inputTokenBudget
    );
    if (context.messages.length === 0 && candidateMessages.length > 0) {
      throw new InputContextLimitError();
    }
    if (context.droppedMessages > 0) {
      this.logger.log("info", "chat.context_truncated", {
        requestId,
        sessionId: request.sessionId,
        droppedMessages: context.droppedMessages,
        estimatedTokens: context.estimatedTokens,
        inputTokenBudget: route.inputTokenBudget
      });
    }

    const startedAt = new Date();
    const startedPerformance = performance.now();
    let firstTokenAt: number | undefined;
    let assistantContent = "";
    let status: RequestMetricRecord["status"] = "failed";
    let errorCode: string | undefined;
    let finishReason: Extract<
      ChatStreamEvent,
      { type: "done" }
    >["finishReason"] = "unknown";
    let usage: TokenUsage | undefined;
    let receivedDone = false;
    let outputLimitReached = false;

    this.store.appendMessage({
      sessionId: request.sessionId,
      requestId,
      role: "user",
      content: request.content
    });

    try {
      yield { type: "route", requestId, route };
      for await (const event of provider.stream({
        requestId,
        model: route.providerModel,
        messages: context.messages,
        maxOutputTokens: route.maxOutputTokens,
        ...(signal ? { signal } : {})
      })) {
        if (event.type === "token") {
          firstTokenAt ??= performance.now();
          const availableCharacters =
            route.maxOutputCharacters - assistantContent.length;
          const accepted = event.text.slice(0, availableCharacters);
          if (accepted) {
            assistantContent += accepted;
            yield { type: "token", text: accepted };
          }
          if (accepted.length < event.text.length || availableCharacters <= 0) {
            outputLimitReached = true;
            break;
          }
        } else {
          receivedDone = true;
          finishReason = event.finishReason;
          usage = validateTokenUsage(event.usage);
          status =
            event.finishReason === "cancelled" ? "cancelled" : "completed";
        }
      }
      if (outputLimitReached) {
        finishReason = "length";
        status = "completed";
      } else if (!receivedDone) {
        throw new Error("Provider stream ended without a terminal event");
      }
      if (status === "completed" && !assistantContent) {
        throw new Error("Provider completed without assistant content");
      }
      yield { type: "done", requestId, finishReason };
    } catch (error) {
      const cancelled = signal?.aborted || isAbortError(error);
      status = cancelled ? "cancelled" : "failed";
      errorCode = error instanceof Error ? error.name : "UNKNOWN_ERROR";
      this.logger.log(
        cancelled ? "info" : "error",
        cancelled ? "chat.cancelled" : "chat.failed",
        {
          requestId,
          sessionId: request.sessionId,
          providerId: route.providerId,
          modelId: route.modelId,
          errorCode
        }
      );
      if (cancelled) {
        yield { type: "done", requestId, finishReason: "cancelled" };
      } else {
        yield {
          type: "error",
          requestId,
          code: errorCode,
          message: "Runtime generation failed"
        };
      }
    } finally {
      if (status === "failed" && signal?.aborted) status = "cancelled";
      if (status === "completed") {
        this.store.appendMessage({
          sessionId: request.sessionId,
          requestId,
          role: "assistant",
          content: assistantContent
        });
      } else {
        this.store.deleteMessagesByRequest({
          sessionId: request.sessionId,
          requestId
        });
      }
      const finishedAt = new Date();
      this.store.recordMetric({
        requestId,
        sessionId: request.sessionId,
        providerId: route.providerId,
        modelId: route.modelId,
        status,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        ...(firstTokenAt === undefined
          ? {}
          : {
              timeToFirstTokenMs: Math.round(firstTokenAt - startedPerformance)
            }),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        ...(usage?.promptTokens === undefined
          ? {}
          : { promptTokens: usage.promptTokens }),
        ...(usage?.completionTokens === undefined
          ? {}
          : { completionTokens: usage.completionTokens }),
        ...(errorCode ? { errorCode } : {})
      });
    }
  }

  public async healthCheck(): Promise<SystemHealth> {
    const route = this.router.route("simple_conversation");
    const provider = this.providers.get(route.providerId);
    const storage = this.store.healthCheck();
    const runtimeHealth: ProviderHealth = provider
      ? await provider.healthCheck()
      : {
          status: "unavailable" as const,
          checkedAt: new Date().toISOString(),
          latencyMs: 0,
          detail: `Provider not registered: ${route.providerId}`
        };
    const runtime: ComponentHealth = {
      name: "runtime",
      status: runtimeHealth.status,
      ...(runtimeHealth.detail ? { detail: runtimeHealth.detail } : {}),
      latencyMs: runtimeHealth.latencyMs
    };
    const available = runtimeHealth.availableModels ?? [];
    const modelAvailable =
      available.includes("*") || available.includes(route.providerModel);
    const model: ComponentHealth = {
      name: "model",
      status:
        runtimeHealth.status === "unavailable"
          ? "unavailable"
          : modelAvailable
            ? "healthy"
            : "degraded",
      detail: modelAvailable
        ? `${route.providerModel} available`
        : `${route.providerModel} not reported by runtime`
    };
    const components: ComponentHealth[] = [
      {
        name: "application",
        status: "healthy",
        detail: "Application initialized"
      },
      storage,
      runtime,
      model
    ];
    const statuses = components.map(({ status }) => status);
    return {
      status: statuses.includes("unavailable")
        ? "unavailable"
        : statuses.includes("degraded")
          ? "degraded"
          : "healthy",
      checkedAt: new Date().toISOString(),
      components
    };
  }

  public publicConfig() {
    return {
      offline: this.config.runtime.offline,
      preset: this.config.routing.preset,
      providerId: this.config.runtime.defaultProviderId,
      hardwareProfiles: this.config.hardwareProfiles
    };
  }

  public close(): void {
    this.store.close();
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function validateTokenUsage(
  usage: TokenUsage | undefined
): TokenUsage | undefined {
  if (!usage) return undefined;
  for (const [name, value] of Object.entries(usage)) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      throw new Error(`Provider returned invalid ${name}`);
    }
  }
  return usage;
}
