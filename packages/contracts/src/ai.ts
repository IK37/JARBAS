import type { Identifier, IsoDateTime } from "./shared.js";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  readonly role: ChatRole;
  readonly content: string;
}

export interface GenerationRequest {
  readonly requestId: Identifier;
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly signal?: AbortSignal;
}

export interface TokenUsage {
  readonly promptTokens?: number;
  readonly completionTokens?: number;
}

export type GenerationEvent =
  | { readonly type: "token"; readonly text: string }
  | {
      readonly type: "done";
      readonly finishReason: "stop" | "length" | "cancelled" | "unknown";
      readonly usage?: TokenUsage;
    };

export interface ProviderModelInfo {
  readonly providerId: string;
  readonly runtimeId: string;
  readonly model: string;
  readonly local: boolean;
}

export interface ProviderHealth {
  readonly status: "healthy" | "degraded" | "unavailable";
  readonly checkedAt: IsoDateTime;
  readonly latencyMs: number;
  readonly detail?: string;
  readonly availableModels?: readonly string[];
}

export interface ChatRequest {
  readonly sessionId: Identifier;
  readonly content: string;
  readonly task?: ModelTask;
}

export interface LlmProvider {
  readonly id: string;
  readonly runtimeId: string;
  stream(request: GenerationRequest): AsyncIterable<GenerationEvent>;
  healthCheck(signal?: AbortSignal): Promise<ProviderHealth>;
  modelInfo(model: string): Promise<ProviderModelInfo>;
}

export type ModelTask =
  | "simple_conversation"
  | "deep_reasoning"
  | "coding"
  | "memory_extraction"
  | "summarization"
  | "tool_selection";

export interface ModelRoute {
  readonly task: ModelTask;
  readonly alias: string;
  readonly modelId: string;
  readonly providerId: string;
  readonly providerModel: string;
  readonly inputTokenBudget: number;
  readonly maxOutputTokens: number;
  readonly maxOutputCharacters: number;
  readonly reason: string;
}

export type ChatStreamEvent =
  | {
      readonly type: "route";
      readonly requestId: Identifier;
      readonly route: ModelRoute;
    }
  | { readonly type: "token"; readonly text: string }
  | {
      readonly type: "done";
      readonly requestId: Identifier;
      readonly finishReason: "stop" | "length" | "cancelled" | "unknown";
    }
  | {
      readonly type: "error";
      readonly requestId: Identifier;
      readonly code: string;
      readonly message: string;
    };
