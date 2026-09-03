import type { ChatRole } from "./ai.js";
import type { Identifier, IsoDateTime } from "./shared.js";

export interface SessionRecord {
  readonly id: Identifier;
  readonly projectId: Identifier;
  readonly title: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface MessageRecord {
  readonly id: Identifier;
  readonly sessionId: Identifier;
  readonly requestId: Identifier;
  readonly role: ChatRole;
  readonly content: string;
  readonly ordinal: number;
  readonly createdAt: IsoDateTime;
}

export interface RequestMetricRecord {
  readonly requestId: Identifier;
  readonly sessionId: Identifier;
  readonly providerId: string;
  readonly modelId: string;
  readonly status: "completed" | "cancelled" | "failed";
  readonly startedAt: IsoDateTime;
  readonly finishedAt: IsoDateTime;
  readonly timeToFirstTokenMs?: number;
  readonly durationMs: number;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly errorCode?: string;
}
