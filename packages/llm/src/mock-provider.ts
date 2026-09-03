import type {
  GenerationEvent,
  GenerationRequest,
  LlmProvider,
  ProviderHealth,
  ProviderModelInfo,
} from "@jarvis/contracts";

export class MockProvider implements LlmProvider {
  public readonly id: string;
  public readonly runtimeId: string;

  public constructor(id = "mock-local") {
    this.id = id;
    this.runtimeId = id;
  }

  public async *stream(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    const latest = [...request.messages].reverse().find(({ role }) => role === "user");
    const response = `JARBAS recebeu: ${latest?.content ?? "mensagem vazia"}`;
    for (const token of response.split(/(?<=\s)/u)) {
      if (request.signal?.aborted) {
        yield { type: "done", finishReason: "cancelled" };
        return;
      }
      yield { type: "token", text: token };
      await Promise.resolve();
    }
    yield { type: "done", finishReason: "stop" };
  }

  public async healthCheck(): Promise<ProviderHealth> {
    return {
      status: "healthy",
      checkedAt: new Date().toISOString(),
      latencyMs: 0,
      detail: "Deterministic provider for development and tests",
      availableModels: ["*"],
    };
  }

  public async modelInfo(model: string): Promise<ProviderModelInfo> {
    return { providerId: this.id, runtimeId: this.runtimeId, model, local: true };
  }
}
