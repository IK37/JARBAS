import type {
  MessageRecord,
  RequestMetricRecord,
  SessionRecord
} from "@jarvis/contracts";

export interface SessionRow {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  session_id: string;
  request_id: string;
  role: MessageRecord["role"];
  content: string;
  ordinal: number;
  created_at: string;
}

export interface RequestMetricRow {
  request_id: string;
  session_id: string;
  provider_id: string;
  model_id: string;
  status: RequestMetricRecord["status"];
  started_at: string;
  finished_at: string;
  first_token_ms: number | null;
  duration_ms: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  error_code: string | null;
}

export function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    requestId: row.request_id,
    role: row.role,
    content: row.content,
    ordinal: row.ordinal,
    createdAt: row.created_at
  };
}

export function mapMetric(row: RequestMetricRow): RequestMetricRecord {
  return {
    requestId: row.request_id,
    sessionId: row.session_id,
    providerId: row.provider_id,
    modelId: row.model_id,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    ...(row.first_token_ms === null
      ? {}
      : { timeToFirstTokenMs: row.first_token_ms }),
    ...(row.prompt_tokens === null ? {} : { promptTokens: row.prompt_tokens }),
    ...(row.completion_tokens === null
      ? {}
      : { completionTokens: row.completion_tokens }),
    ...(row.error_code === null ? {} : { errorCode: row.error_code })
  };
}
