import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

import type {
  MessageRecord,
  RequestMetricRecord,
  SessionRecord
} from "@jarvis/contracts";

import type { AppendMessageInput, SessionStore } from "./session-store.js";

interface SessionRow {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  request_id: string;
  role: MessageRecord["role"];
  content: string;
  ordinal: number;
  created_at: string;
}

const migration001 = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    content TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(session_id, ordinal)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, ordinal);

  CREATE TABLE IF NOT EXISTS request_metrics (
    request_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('completed', 'cancelled', 'failed')),
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL,
    first_token_ms INTEGER,
    duration_ms INTEGER NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    error_code TEXT
  ) STRICT;
`;

export class SqliteSessionStore implements SessionStore {
  private constructor(private readonly database: DatabaseSync) {}

  public static async open(databasePath: string): Promise<SqliteSessionStore> {
    const resolvedPath =
      databasePath === ":memory:" ? databasePath : resolve(databasePath);
    if (resolvedPath !== ":memory:")
      await mkdir(dirname(resolvedPath), { recursive: true });
    const database = new DatabaseSync(resolvedPath);
    const store = new SqliteSessionStore(database);
    store.migrate();
    return store;
  }

  public createSession(projectId: string, title: string): SessionRecord {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          "INSERT OR IGNORE INTO projects (id, name, created_at) VALUES (?, ?, ?)"
        )
        .run(projectId, projectId === "inbox" ? "Inbox" : projectId, now);
      this.database
        .prepare(
          "INSERT INTO sessions (id, project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
        )
        .run(id, projectId, title, now, now);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return { id, projectId, title, createdAt: now, updatedAt: now };
  }

  public getSession(id: string): SessionRecord | undefined {
    const row = this.database
      .prepare(
        "SELECT id, project_id, title, created_at, updated_at FROM sessions WHERE id = ?"
      )
      .get(id) as unknown as SessionRow | undefined;
    return row ? mapSession(row) : undefined;
  }

  public listMessages(sessionId: string): readonly MessageRecord[] {
    const rows = this.database
      .prepare(
        "SELECT id, session_id, request_id, role, content, ordinal, created_at FROM messages WHERE session_id = ? ORDER BY ordinal"
      )
      .all(sessionId) as unknown as MessageRow[];
    return rows.map(mapMessage);
  }

  public appendMessage(input: AppendMessageInput): MessageRecord {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const ordinalRow = this.database
        .prepare(
          "SELECT COALESCE(MAX(ordinal), -1) + 1 AS ordinal FROM messages WHERE session_id = ?"
        )
        .get(input.sessionId) as unknown as { ordinal: number };
      this.database
        .prepare(
          "INSERT INTO messages (id, session_id, request_id, role, content, ordinal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          id,
          input.sessionId,
          input.requestId,
          input.role,
          input.content,
          ordinalRow.ordinal,
          createdAt
        );
      this.database
        .prepare("UPDATE sessions SET updated_at = ? WHERE id = ?")
        .run(createdAt, input.sessionId);
      this.database.exec("COMMIT");
      return { ...input, id, ordinal: ordinalRow.ordinal, createdAt };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  public recordMetric(metric: RequestMetricRecord): void {
    this.database
      .prepare(
        `INSERT OR REPLACE INTO request_metrics (
          request_id, session_id, provider_id, model_id, status, started_at, finished_at,
          first_token_ms, duration_ms, prompt_tokens, completion_tokens, error_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        metric.requestId,
        metric.sessionId,
        metric.providerId,
        metric.modelId,
        metric.status,
        metric.startedAt,
        metric.finishedAt,
        metric.timeToFirstTokenMs ?? null,
        metric.durationMs,
        metric.promptTokens ?? null,
        metric.completionTokens ?? null,
        metric.errorCode ?? null
      );
  }

  public healthCheck() {
    const started = performance.now();
    try {
      this.database.prepare("SELECT 1 AS ok").get();
      return {
        name: "storage" as const,
        status: "healthy" as const,
        detail: "SQLite reachable",
        latencyMs: Math.round(performance.now() - started)
      };
    } catch (error) {
      return {
        name: "storage" as const,
        status: "unavailable" as const,
        detail:
          error instanceof Error ? error.message : "Unknown storage error",
        latencyMs: Math.round(performance.now() - started)
      };
    }
  }

  public close(): void {
    this.database.close();
  }

  private migrate(): void {
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);
    const applied = this.database
      .prepare("SELECT 1 AS applied FROM schema_migrations WHERE version = 1")
      .get();
    if (applied) return;

    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.exec(migration001);
      this.database
        .prepare(
          "INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)"
        )
        .run(new Date().toISOString());
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMessage(row: MessageRow): MessageRecord {
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
