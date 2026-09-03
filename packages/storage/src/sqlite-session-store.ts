import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

import type { AppendMessageInput, SessionStorePort } from "@jarvis/application";
import type {
  DeleteMessagesByRequestInput,
  MessageRecord,
  RequestMetricRecord,
  SessionRecord
} from "@jarvis/contracts";

import { migrateDatabase } from "./migrations.js";
import {
  mapMessage,
  mapMetric,
  mapSession,
  type MessageRow,
  type RequestMetricRow,
  type SessionRow
} from "./row-mappers.js";

export class SqliteSessionStore implements SessionStorePort {
  private constructor(private readonly database: DatabaseSync) {}

  public static async open(databasePath: string): Promise<SqliteSessionStore> {
    const resolvedPath =
      databasePath === ":memory:" ? databasePath : resolve(databasePath);
    if (resolvedPath !== ":memory:")
      await mkdir(dirname(resolvedPath), { recursive: true });
    const database = new DatabaseSync(resolvedPath);
    const store = new SqliteSessionStore(database);
    migrateDatabase(database);
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

  public deleteMessagesByRequest(input: DeleteMessagesByRequestInput): number {
    const result = this.database
      .prepare("DELETE FROM messages WHERE session_id = ? AND request_id = ?")
      .run(input.sessionId, input.requestId);
    return Number(result.changes);
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

  public getMetric(requestId: string): RequestMetricRecord | undefined {
    const row = this.database
      .prepare(
        `SELECT request_id, session_id, provider_id, model_id, status, started_at,
          finished_at, first_token_ms, duration_ms, prompt_tokens,
          completion_tokens, error_code
        FROM request_metrics WHERE request_id = ?`
      )
      .get(requestId) as unknown as RequestMetricRow | undefined;
    return row ? mapMetric(row) : undefined;
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
}
