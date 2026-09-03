import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";

import { SqliteSessionStore } from "@jarvis/storage";

test("SQLite persists sessions and messages across restarts", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "jarbas-store-"));
  const databasePath = resolve(directory, "jarbas.db");
  try {
    const first = await SqliteSessionStore.open(databasePath);
    const session = first.createSession("project-a", "Persistent session");
    first.appendMessage({
      sessionId: session.id,
      requestId: "request-a",
      role: "user",
      content: "Olá"
    });
    first.close();

    const second = await SqliteSessionStore.open(databasePath);
    assert.equal(second.getSession(session.id)?.title, "Persistent session");
    assert.equal(second.listMessages(session.id)[0]?.content, "Olá");
    second.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
