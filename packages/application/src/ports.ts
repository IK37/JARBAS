import type {
  ComponentHealth,
  DeleteMessagesByRequestInput,
  MessageRecord,
  ModelRoute,
  ModelTask,
  RequestMetricRecord,
  SessionRecord
} from "@jarvis/contracts";

export interface AppendMessageInput {
  readonly sessionId: string;
  readonly requestId: string;
  readonly role: MessageRecord["role"];
  readonly content: string;
}

export interface SessionStorePort {
  createSession(projectId: string, title: string): SessionRecord;
  getSession(id: string): SessionRecord | undefined;
  listMessages(sessionId: string): readonly MessageRecord[];
  appendMessage(input: AppendMessageInput): MessageRecord;
  deleteMessagesByRequest(input: DeleteMessagesByRequestInput): number;
  recordMetric(metric: RequestMetricRecord): void;
  getMetric(requestId: string): RequestMetricRecord | undefined;
  healthCheck(): ComponentHealth;
  close(): void;
}

export interface ApplicationLogger {
  log(
    level: "debug" | "info" | "warn" | "error",
    event: string,
    fields?: Readonly<Record<string, unknown>>
  ): void;
}

export interface ModelRouteResolver {
  route(task: ModelTask): ModelRoute;
}
