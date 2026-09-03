import assert from "node:assert/strict";
import { test } from "node:test";

import { MockProvider } from "@jarvis/llm";
import { SqliteSessionStore } from "@jarvis/storage";

import {
  createApplication,
  providerWithStream,
  testConfig
} from "./helpers.mjs";

test("application streams and persists a complete assistant turn", async () => {
  const config = await testConfig();
  const store = await SqliteSessionStore.open(":memory:");
  const provider = new MockProvider();
  const application = createApplication(config, store, provider);
  const session = application.createSession();
  const events = [];
  for await (const event of application.chat({
    sessionId: session.id,
    content: "teste real"
  }))
    events.push(event);
  assert.equal(events[0]?.type, "route");
  assert.equal(events.at(-1)?.type, "done");
  assert.deepEqual(
    application.listMessages(session.id).map(({ role }) => role),
    ["user", "assistant"]
  );
  assert.match(
    application.listMessages(session.id)[1]?.content ?? "",
    /teste real/u
  );
  application.close();
});

test("application persists provider token usage", async () => {
  const config = await testConfig();
  const store = await SqliteSessionStore.open(":memory:");
  const provider = providerWithStream(async function* () {
    yield { type: "token", text: "resposta" };
    yield {
      type: "done",
      finishReason: "stop",
      usage: { promptTokens: 12, completionTokens: 3 }
    };
  });
  const application = createApplication(config, store, provider);
  const session = application.createSession();
  const events = [];
  for await (const event of application.chat({
    sessionId: session.id,
    content: "uso"
  }))
    events.push(event);
  const requestId = events.find(({ type }) => type === "route")?.requestId;
  assert.ok(requestId);
  assert.equal(store.getMetric(requestId)?.promptTokens, 12);
  assert.equal(store.getMetric(requestId)?.completionTokens, 3);
  application.close();
});

test("application bounds output and contains provider failures", async () => {
  const baseConfig = await testConfig();
  const config = {
    ...baseConfig,
    generation: { ...baseConfig.generation, maxOutputCharacters: 5 }
  };
  const store = await SqliteSessionStore.open(":memory:");
  const provider = providerWithStream(async function* () {
    yield { type: "token", text: "123456789" };
    yield { type: "done", finishReason: "stop" };
  });
  const application = createApplication(config, store, provider);
  const session = application.createSession();
  const bounded = [];
  for await (const event of application.chat({
    sessionId: session.id,
    content: "limite"
  }))
    bounded.push(event);
  assert.equal(
    bounded.filter(({ type }) => type === "token")[0]?.text,
    "12345"
  );
  assert.equal(bounded.at(-1)?.finishReason, "length");
  assert.equal(application.listMessages(session.id)[1]?.content, "12345");

  const failingStore = await SqliteSessionStore.open(":memory:");
  const failingProvider = providerWithStream(async function* () {
    yield { type: "token", text: "parcial" };
    throw new Error("sensitive upstream detail");
  });
  const failingApplication = createApplication(
    baseConfig,
    failingStore,
    failingProvider
  );
  const failingSession = failingApplication.createSession();
  const failed = [];
  for await (const event of failingApplication.chat({
    sessionId: failingSession.id,
    content: "falhar"
  }))
    failed.push(event);
  assert.equal(failed.at(-1)?.type, "error");
  assert.equal(failed.at(-1)?.message, "Runtime generation failed");
  assert.deepEqual(failingApplication.listMessages(failingSession.id), []);
  const failedRequestId = failed[0]?.requestId;
  assert.ok(failedRequestId);
  assert.equal(failingStore.getMetric(failedRequestId)?.status, "failed");

  const invalidUsageStore = await SqliteSessionStore.open(":memory:");
  const invalidUsageProvider = providerWithStream(async function* () {
    yield { type: "token", text: "não persistir" };
    yield {
      type: "done",
      finishReason: "stop",
      usage: { promptTokens: "invalid", completionTokens: 1e20 }
    };
  });
  const invalidUsageApplication = createApplication(
    baseConfig,
    invalidUsageStore,
    invalidUsageProvider
  );
  const invalidUsageSession = invalidUsageApplication.createSession();
  const invalidUsageEvents = [];
  for await (const event of invalidUsageApplication.chat({
    sessionId: invalidUsageSession.id,
    content: "usage inválido"
  }))
    invalidUsageEvents.push(event);
  assert.equal(invalidUsageEvents.at(-1)?.type, "error");
  assert.deepEqual(
    invalidUsageApplication.listMessages(invalidUsageSession.id),
    []
  );
  const invalidUsageRequestId = invalidUsageEvents[0]?.requestId;
  assert.ok(invalidUsageRequestId);
  assert.equal(
    invalidUsageStore.getMetric(invalidUsageRequestId)?.status,
    "failed"
  );
  application.close();
  failingApplication.close();
  invalidUsageApplication.close();
});

test("application rejects concurrent turns in one session", async () => {
  const config = await testConfig();
  const store = await SqliteSessionStore.open(":memory:");
  const application = createApplication(config, store, new MockProvider());
  const session = application.createSession();
  const firstStream = application.chat({
    sessionId: session.id,
    content: "primeira"
  });
  const first = firstStream[Symbol.asyncIterator]();
  assert.equal((await first.next()).value?.type, "route");
  const secondStream = application.chat({
    sessionId: session.id,
    content: "segunda"
  });
  const second = secondStream[Symbol.asyncIterator]();
  await assert.rejects(second.next(), { name: "SessionBusyError" });
  await first.return();
  assert.deepEqual(application.listMessages(session.id), []);
  application.close();
});

test("cancelled turns do not persist partial conversation content", async () => {
  const config = await testConfig();
  const store = await SqliteSessionStore.open(":memory:");
  const logs = [];
  const application = createApplication(
    config,
    store,
    new MockProvider(),
    logs
  );
  const session = application.createSession();
  const controller = new AbortController();
  const stream = application.chat(
    { sessionId: session.id, content: "cancelar agora" },
    controller.signal
  );
  const iterator = stream[Symbol.asyncIterator]();
  const route = await iterator.next();
  const token = await iterator.next();
  assert.equal(route.value?.type, "route");
  assert.equal(token.value?.type, "token");
  controller.abort();
  const done = await iterator.next();
  assert.equal(done.value?.type, "done");
  assert.equal(done.value?.finishReason, "cancelled");
  await iterator.next();
  assert.deepEqual(application.listMessages(session.id), []);
  assert.equal(store.getMetric(route.value.requestId)?.status, "cancelled");
  assert.equal(
    logs.some(({ event }) => event === "chat.failed"),
    false
  );
  application.close();
});

test("application rolls back a stream without a terminal event", async () => {
  const config = await testConfig();
  const store = await SqliteSessionStore.open(":memory:");
  const provider = providerWithStream(async function* () {
    yield { type: "token", text: "resposta parcial" };
  });
  const application = createApplication(config, store, provider);
  const session = application.createSession();
  const events = [];
  for await (const event of application.chat({
    sessionId: session.id,
    content: "não persistir"
  }))
    events.push(event);

  assert.equal(events.at(-1)?.type, "error");
  assert.deepEqual(application.listMessages(session.id), []);
  const requestId = events[0]?.requestId;
  assert.ok(requestId);
  assert.equal(store.getMetric(requestId)?.status, "failed");
  application.close();
});
