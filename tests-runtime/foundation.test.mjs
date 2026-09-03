import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";

import { JarbasApplication } from "@jarvis/application";
import { loadConfig } from "@jarvis/config";
import { MockProvider, OpenAiCompatibleProvider } from "@jarvis/llm";
import { JsonLogger, redact } from "@jarvis/observability";
import { ModelRouter } from "@jarvis/routing";
import { SqliteSessionStore } from "@jarvis/storage";

import { buildServer } from "../apps/api/dist/build-server.js";

async function testConfig(databasePath = ":memory:") {
  return loadConfig(resolve(process.cwd(), "configs"), {
    JARBAS_PROVIDER: "mock-local",
    JARBAS_DATABASE_PATH: databasePath,
  });
}

test("configuration validates a mock-local development override", async () => {
  const config = await testConfig();
  assert.equal(config.runtime.defaultProviderId, "mock-local");
  assert.equal(config.server.host, "127.0.0.1");
});

test("model router keeps model identity separate from execution runtime", async () => {
  const route = new ModelRouter(await testConfig()).route("coding");
  assert.equal(route.modelId, "qwen35-9b-q4km");
  assert.equal(route.providerId, "mock-local");
  assert.equal(route.providerModel, route.modelId);
});

test("SQLite persists sessions and messages across restarts", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "jarbas-store-"));
  const databasePath = resolve(directory, "jarbas.db");
  try {
    const first = await SqliteSessionStore.open(databasePath);
    const session = first.createSession("project-a", "Persistent session");
    first.appendMessage({ sessionId: session.id, requestId: "request-a", role: "user", content: "Olá" });
    first.close();

    const second = await SqliteSessionStore.open(databasePath);
    assert.equal(second.getSession(session.id)?.title, "Persistent session");
    assert.equal(second.listMessages(session.id)[0]?.content, "Olá");
    second.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("application streams and persists a complete assistant turn", async () => {
  const config = await testConfig();
  const store = await SqliteSessionStore.open(":memory:");
  const provider = new MockProvider();
  const application = new JarbasApplication(
    config,
    store,
    new Map([[provider.id, provider]]),
    new JsonLogger("error", () => {}),
  );
  const session = application.createSession();
  const events = [];
  for await (const event of application.chat({ sessionId: session.id, content: "teste real" })) events.push(event);
  assert.equal(events[0]?.type, "route");
  assert.equal(events.at(-1)?.type, "done");
  assert.deepEqual(application.listMessages(session.id).map(({ role }) => role), ["user", "assistant"]);
  assert.match(application.listMessages(session.id)[1]?.content ?? "", /teste real/u);
  application.close();
});

test("OpenAI-compatible provider parses SSE and verifies available models", async () => {
  const upstream = createServer((request, response) => {
    if (request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "test-model" }] }));
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end('data: {"choices":[{"delta":{"content":"Olá "}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"mundo"},"finish_reason":"stop"}]}\r\n\r\ndata: [DONE]\r\n\r\n');
  });
  await listen(upstream);
  try {
    const address = upstream.address();
    assert.ok(address && typeof address === "object");
    const provider = new OpenAiCompatibleProvider({
      id: "test-runtime",
      kind: "openai_compatible",
      label: "Test",
      endpoint: `http://127.0.0.1:${address.port}/v1`,
      local: true,
      backend: "cpu",
      capabilities: { streaming: true, structuredOutput: true, toolCalling: false, embeddings: false, vision: false },
      requestTimeoutMs: 2_000,
    });
    const health = await provider.healthCheck();
    assert.deepEqual(health.availableModels, ["test-model"]);
    let text = "";
    for await (const event of provider.stream({ requestId: "r", model: "test-model", messages: [{ role: "user", content: "Oi" }] })) {
      if (event.type === "token") text += event.text;
    }
    assert.equal(text, "Olá mundo");
  } finally {
    await close(upstream);
  }
});

test("HTTP boundary serves UI, rejects hostile origins and streams chat", async () => {
  const config = await testConfig();
  const store = await SqliteSessionStore.open(":memory:");
  const provider = new MockProvider();
  const application = new JarbasApplication(config, store, new Map([[provider.id, provider]]), new JsonLogger("error", () => {}));
  const server = buildServer(config, application);
  await listen(server);
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(`${base}/api/health`, { headers: { origin: "https://evil.example" } })).status, 403);
    const sessionResponse = await fetch(`${base}/api/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const session = await sessionResponse.json();
    const chat = await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: session.id, content: "integração" }) });
    assert.equal(chat.status, 200);
    const events = (await chat.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(
      events.filter(({ type }) => type === "token").map(({ text }) => text).join(""),
      "JARBAS recebeu: integração",
    );
  } finally {
    await close(server);
    application.close();
  }
});

test("observability redacts nested credentials and bearer values", () => {
  assert.deepEqual(redact({ apiKey: "abc", promptTokens: 42, nested: { note: "Bearer secret-token" } }), {
    apiKey: "[REDACTED]",
    promptTokens: 42,
    nested: { note: "Bearer [REDACTED]" },
  });
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
