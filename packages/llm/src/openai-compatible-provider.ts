import type {
  GenerationEvent,
  GenerationRequest,
  LlmProvider,
  ProviderHealth,
  ProviderModelInfo,
  RuntimeDefinition
} from "@jarvis/contracts";

type FinishReason = "stop" | "length" | "cancelled" | "unknown";

interface ParsedStreamChunk {
  readonly choiceCount: number;
  readonly content?: string;
  readonly finishReason?: FinishReason;
  readonly usage?: {
    readonly promptTokens?: number;
    readonly completionTokens?: number;
  };
}

export class OpenAiCompatibleProvider implements LlmProvider {
  public readonly id: string;
  public readonly runtimeId: string;

  public constructor(
    private readonly runtime: RuntimeDefinition,
    private readonly apiKey?: string
  ) {
    if (!runtime.endpoint)
      throw new Error(`Runtime ${runtime.id} is missing an endpoint`);
    this.id = runtime.id;
    this.runtimeId = runtime.id;
  }

  public async *stream(
    request: GenerationRequest
  ): AsyncIterable<GenerationEvent> {
    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(request.temperature === undefined
          ? {}
          : { temperature: request.temperature }),
        ...(request.maxOutputTokens === undefined
          ? {}
          : { max_tokens: request.maxOutputTokens })
      }),
      signal: this.signal(request.signal)
    });

    if (!response.ok) {
      throw new Error(`Runtime ${this.id} returned HTTP ${response.status}`);
    }
    if (!response.body)
      throw new Error(`Runtime ${this.id} returned no response stream`);

    let finishReason: FinishReason = "unknown";
    let usage: { promptTokens?: number; completionTokens?: number } | undefined;
    let receivedTerminalMarker = false;

    for await (const payload of parseServerSentEvents(
      response.body,
      this.runtime.maxStreamEventBytes
    )) {
      if (payload === "[DONE]") {
        receivedTerminalMarker = true;
        break;
      }
      const chunk = parseStreamChunk(payload);
      if (receivedTerminalMarker && chunk.choiceCount > 0) {
        throw new Error("Runtime returned choices after a terminal marker");
      }
      if (chunk.content) yield { type: "token", text: chunk.content };
      if (chunk.finishReason) {
        finishReason = chunk.finishReason;
        receivedTerminalMarker = true;
      }
      if (chunk.usage) usage = chunk.usage;
    }
    if (!receivedTerminalMarker) {
      throw new Error("Runtime stream ended without a terminal marker");
    }
    yield { type: "done", finishReason, ...(usage ? { usage } : {}) };
  }

  public async healthCheck(signal?: AbortSignal): Promise<ProviderHealth> {
    const started = performance.now();
    try {
      const response = await fetch(`${this.endpoint}/models`, {
        headers: this.headers(),
        signal: this.signal(signal, 5_000)
      });
      const payload = response.ok
        ? ((await response.json()) as { data?: { id?: string }[] })
        : undefined;
      return {
        status: response.ok ? "healthy" : "degraded",
        checkedAt: new Date().toISOString(),
        latencyMs: Math.round(performance.now() - started),
        detail: response.ok
          ? "Runtime endpoint reachable"
          : `HTTP ${response.status}`,
        ...(payload?.data
          ? {
              availableModels: payload.data.flatMap((item) =>
                item.id ? [item.id] : []
              )
            }
          : {})
      };
    } catch (error) {
      return {
        status: "unavailable",
        checkedAt: new Date().toISOString(),
        latencyMs: Math.round(performance.now() - started),
        detail: error instanceof Error ? error.message : "Unknown runtime error"
      };
    }
  }

  public async modelInfo(model: string): Promise<ProviderModelInfo> {
    return {
      providerId: this.id,
      runtimeId: this.runtimeId,
      model,
      local: this.runtime.local
    };
  }

  private get endpoint(): string {
    return this.runtime.endpoint?.replace(/\/$/u, "") ?? "";
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
    };
  }

  private signal(
    signal?: AbortSignal,
    timeoutMs = this.runtime.requestTimeoutMs
  ): AbortSignal {
    const timeout = AbortSignal.timeout(timeoutMs);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
  }
}

function normalizeFinishReason(reason: string): FinishReason {
  if (reason === "stop") return "stop";
  if (reason === "length") return "length";
  if (reason === "cancelled") return "cancelled";
  return "unknown";
}

function readFinishReason(value: unknown): FinishReason | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Runtime returned invalid finish_reason");
  }
  return normalizeFinishReason(value);
}

function parseStreamChunk(payload: string): ParsedStreamChunk {
  const root = readObject(JSON.parse(payload) as unknown, "stream chunk");
  const choices = readChoices(root.choices);
  const choice = choices[0];
  const delta = choice ? readOptionalObject(choice.delta, "delta") : undefined;
  const content = readContent(delta?.content);
  const finishReason = readFinishReason(choice?.finish_reason);
  const usage = readUsage(root.usage);

  return {
    choiceCount: choices.length,
    ...(content === undefined ? {} : { content }),
    ...(finishReason === undefined ? {} : { finishReason }),
    ...(usage === undefined ? {} : { usage })
  };
}

function readChoices(value: unknown): readonly Record<string, unknown>[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error("Runtime returned invalid choices");
  }
  return value.map((choice) => readObject(choice, "choice"));
}

function readOptionalObject(
  value: unknown,
  field: string
): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  return readObject(value, field);
}

function readObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Runtime returned invalid ${field}`);
  }
  return value as Record<string, unknown>;
}

function readContent(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new Error("Runtime returned invalid delta.content");
  }
  return value;
}

function readUsage(value: unknown): ParsedStreamChunk["usage"] | undefined {
  const usage = readOptionalObject(value, "usage");
  if (!usage) return undefined;
  const promptTokens = tokenCount(usage.prompt_tokens, "prompt_tokens");
  const completionTokens = tokenCount(
    usage.completion_tokens,
    "completion_tokens"
  );
  return {
    ...(promptTokens === undefined ? {} : { promptTokens }),
    ...(completionTokens === undefined ? {} : { completionTokens })
  };
}

function tokenCount(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Runtime returned invalid ${field}`);
  }
  return value;
}

async function* parseServerSentEvents(
  stream: ReadableStream<Uint8Array>,
  maxEventBytes: number
): AsyncIterable<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const bytes of stream) {
    buffer += decoder.decode(bytes, { stream: true });
    buffer = buffer.replaceAll("\r\n", "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const event = buffer.slice(0, boundary);
      enforceEventLimit(event, maxEventBytes);
      buffer = buffer.slice(boundary + 2);
      for (const line of event.split("\n")) {
        if (line.startsWith("data:") && line.slice(5).trim())
          yield line.slice(5).trim();
      }
      boundary = buffer.indexOf("\n\n");
    }
    enforceEventLimit(buffer, maxEventBytes);
  }
  buffer += decoder.decode();
  enforceEventLimit(buffer, maxEventBytes);
  for (const line of buffer.split("\n")) {
    if (line.startsWith("data:") && line.slice(5).trim())
      yield line.slice(5).trim();
  }
}

function enforceEventLimit(event: string, maxEventBytes: number): void {
  if (new TextEncoder().encode(event).byteLength > maxEventBytes) {
    throw new Error("Runtime stream event exceeds configured limit");
  }
}
