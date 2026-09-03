import { randomUUID } from "node:crypto";

import type {
  ChatRequest,
  ChatStreamEvent,
  ComponentHealth,
  JarbasConfig,
  LlmProvider,
  MessageRecord,
  ProviderHealth,
  RequestMetricRecord,
  SessionRecord,
  SystemHealth
} from "@jarvis/contracts";
import type { Logger } from "@jarvis/observability";
import { ModelRouter } from "@jarvis/routing";
import type { SessionStore } from "@jarvis/storage";

export class JarbasApplication {
  private readonly router: ModelRouter;

  public constructor(
    private readonly config: JarbasConfig,
    private readonly store: SessionStore,
    private readonly providers: ReadonlyMap<string, LlmProvider>,
    private readonly logger: Logger
  ) {
    this.router = new ModelRouter(config);
  }

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
    if (!request.content.trim())
      throw new Error("Message content cannot be empty");
    if (!this.store.getSession(request.sessionId))
      throw new Error("Session not found");

    const requestId = randomUUID();
    const route = this.router.route(request.task ?? "simple_conversation");
    const provider = this.providers.get(route.providerId);
    if (!provider)
      throw new Error(`Provider not registered: ${route.providerId}`);

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

    this.store.appendMessage({
      sessionId: request.sessionId,
      requestId,
      role: "user",
      content: request.content
    });
    const messages = this.store
      .listMessages(request.sessionId)
      .filter(({ role }) => role === "user" || role === "assistant")
      .map(({ role, content }) => ({ role, content }));

    yield { type: "route", requestId, route };
    try {
      for await (const event of provider.stream({
        requestId,
        model: route.providerModel,
        messages,
        ...(signal ? { signal } : {})
      })) {
        if (event.type === "token") {
          firstTokenAt ??= performance.now();
          assistantContent += event.text;
          yield event;
        } else {
          finishReason = event.finishReason;
          status =
            event.finishReason === "cancelled" ? "cancelled" : "completed";
        }
      }
      if (status === "failed")
        status = signal?.aborted ? "cancelled" : "completed";
      yield { type: "done", requestId, finishReason };
    } catch (error) {
      status = signal?.aborted ? "cancelled" : "failed";
      errorCode = error instanceof Error ? error.name : "UNKNOWN_ERROR";
      this.logger.log("error", "chat.failed", {
        requestId,
        sessionId: request.sessionId,
        providerId: route.providerId,
        modelId: route.modelId,
        errorCode
      });
      throw error;
    } finally {
      if (assistantContent) {
        this.store.appendMessage({
          sessionId: request.sessionId,
          requestId,
          role: "assistant",
          content: assistantContent
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
