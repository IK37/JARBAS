import type {
  ChatRole,
  ComponentHealth,
  MessageRecord,
  RequestMetricRecord,
  SessionRecord,
} from "@jarvis/contracts";

export interface AppendMessageInput {
  readonly sessionId: string;
  readonly requestId: string;
  readonly role: ChatRole;
  readonly content: string;
}

export interface SessionStore {
  createSession(projectId: string, title: string): SessionRecord;
  getSession(id: string): SessionRecord | undefined;
  listMessages(sessionId: string): readonly MessageRecord[];
  appendMessage(input: AppendMessageInput): MessageRecord;
  recordMetric(metric: RequestMetricRecord): void;
  healthCheck(): ComponentHealth;
  close(): void;
}
