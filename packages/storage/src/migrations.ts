import type { DatabaseSync } from "node:sqlite";

const migrations = [
  {
    version: 1,
    sql: `
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

      CREATE INDEX IF NOT EXISTS idx_messages_session
        ON messages(session_id, ordinal);

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
    `
  }
] as const;

export function migrateDatabase(database: DatabaseSync): void {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);

  for (const migration of migrations) {
    const applied = database
      .prepare("SELECT 1 AS applied FROM schema_migrations WHERE version = ?")
      .get(migration.version);
    if (applied) continue;
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(migration.sql);
      database
        .prepare(
          "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)"
        )
        .run(migration.version, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
