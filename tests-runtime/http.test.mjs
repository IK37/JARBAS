import assert from "node:assert/strict";
import { test } from "node:test";

import { MockProvider } from "@jarvis/llm";
import { SqliteSessionStore } from "@jarvis/storage";
import { validateConfig } from "@jarvis/config";

import { buildServer } from "../apps/api/dist/build-server.js";
import {
  assertServerAddress,
  close,
  createApplication,
  disconnectAfterFirstChunk,
  listen,
  providerWithStream,
  testConfig,
  waitUntil
} from "./helpers.mjs";

test("HTTP boundary validates origins, payloads and streaming", async () => {
  const config = await testConfig();
  const store = await SqliteSessionStore.open(":memory:");
  const application = createApplication(config, store, new MockProvider());
  const server = buildServer(config, application);
  await listen(server);
  const address = assertServerAddress(server);
  const base = `http://127.0.0.1:${address.port}`;
  const origin = `http://127.0.0.1:${config.server.port}`;
  try {
    assert.equal((await fetch(base)).status, 200);
    assert.equal(
      (
        await fetch(`${base}/api/health`, {
          headers: { origin: "https://evil.example" }
        })
      ).status,
      403
    );
    const sessionResponse = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: "{}"
    });
    assert.equal(sessionResponse.status, 201);
    const session = await sessionResponse.json();
    const chat = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ sessionId: session.id, content: "integração" })
    });
    assert.equal(chat.status, 200);
    const events = (await chat.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(
      events
        .filter(({ type }) => type === "token")
        .map(({ text }) => text)
        .join(""),
      "JARBAS recebeu: integração"
    );
    assert.match(
      chat.headers.get("content-security-policy") ?? "",
      /default-src 'self'/u
    );

    const missingSession = await postJson(`${base}/api/chat`, {
      sessionId: "missing",
      content: "teste"
    });
    assert.equal(missingSession.status, 404);
    assert.equal((await missingSession.json()).error, "Session not found");

    const invalidTask = await postJson(`${base}/api/chat`, {
      sessionId: session.id,
      content: "teste",
      task: "invalid"
    });
    assert.equal(invalidTask.status, 400);

    const invalidType = await postJson(`${base}/api/chat`, {
      sessionId: session.id,
      content: 42
    });
    assert.equal(invalidType.status, 400);

    const unsupportedMedia = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}"
    });
    assert.equal(unsupportedMedia.status, 415);

    const contextOverflow = await postJson(`${base}/api/chat`, {
      sessionId: session.id,
      content: "x".repeat(49_500)
    });
    assert.equal(contextOverflow.status, 413);
  } finally {
    await close(server);
    application.close();
  }
});

test("client disconnect releases the session turn and removes partial state", async () => {
  const config = await testConfig();
  const store = await SqliteSessionStore.open(":memory:");
  const provider = providerWithStream(async function* (request) {
    await new Promise((resolve) => {
      if (request.signal?.aborted) resolve();
      else request.signal?.addEventListener("abort", resolve, { once: true });
    });
    yield { type: "done", finishReason: "cancelled" };
  });
  const application = createApplication(config, store, provider);
  const session = application.createSession();
  const server = buildServer(config, application);
  await listen(server);
  const address = assertServerAddress(server);
  try {
    const route = await disconnectAfterFirstChunk(
      address.port,
      JSON.stringify({ sessionId: session.id, content: "interromper" })
    );
    await waitUntil(
      () =>
        application.listMessages(session.id).length === 0 &&
        store.getMetric(route.requestId)?.status === "cancelled"
    );
    const followUpStream = application.chat({
      sessionId: session.id,
      content: "nova tentativa"
    });
    const followUp = followUpStream[Symbol.asyncIterator]();
    assert.equal((await followUp.next()).value?.type, "route");
    await followUp.return();
  } finally {
    await close(server);
    application.close();
  }
});

test("IPv6 loopback origin is formatted safely", async () => {
  const baseConfig = await testConfig();
  const config = {
    ...baseConfig,
    server: {
      ...baseConfig.server,
      host: "::1",
      allowedOrigins: [`http://[::1]:${baseConfig.server.port}`]
    }
  };
  validateConfig(config);
  const store = await SqliteSessionStore.open(":memory:");
  const application = createApplication(config, store, new MockProvider());
  const server = buildServer(config, application);
  await listen(server);
  const address = assertServerAddress(server);
  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/sessions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: `http://[::1]:${config.server.port}`
        },
        body: "{}"
      }
    );
    assert.equal(response.status, 201);
  } finally {
    await close(server);
    application.close();
  }
});

function postJson(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
