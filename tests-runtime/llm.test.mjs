import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";

import { OpenAiCompatibleProvider } from "@jarvis/llm";

import { close, listen } from "./helpers.mjs";

test("OpenAI-compatible provider parses SSE and verifies available models", async () => {
  const upstream = createServer((request, response) => {
    if (request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "test-model" }] }));
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      'data: {"choices":[{"delta":{"content":"Olá "}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"mundo"}}]}\r\n\r\ndata: [DONE]\r\n\r\n'
    );
  });
  await listen(upstream);
  try {
    const address = upstream.address();
    assert.ok(address && typeof address === "object");
    const provider = createProvider(address.port);
    const health = await provider.healthCheck();
    assert.deepEqual(health.availableModels, ["test-model"]);
    let text = "";
    for await (const event of provider.stream({
      requestId: "r",
      model: "test-model",
      messages: [{ role: "user", content: "Oi" }]
    })) {
      if (event.type === "token") text += event.text;
      else assert.equal(event.finishReason, "unknown");
    }
    assert.equal(text, "Olá mundo");
  } finally {
    await close(upstream);
  }
});

test("OpenAI-compatible provider accepts an explicit finish reason", async () => {
  const upstream = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      'data: {"choices":[{"delta":{"content":"completa"},"finish_reason":"stop"}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":1}}\n\n'
    );
  });
  await listen(upstream);
  try {
    const address = upstream.address();
    assert.ok(address && typeof address === "object");
    const events = [];
    for await (const event of createProvider(address.port).stream({
      requestId: "finish-reason",
      model: "test-model",
      messages: [{ role: "user", content: "Oi" }]
    }))
      events.push(event);
    assert.deepEqual(events, [
      { type: "token", text: "completa" },
      {
        type: "done",
        finishReason: "stop",
        usage: { promptTokens: 2, completionTokens: 1 }
      }
    ]);
  } finally {
    await close(upstream);
  }
});

test("OpenAI-compatible provider rejects choices after a finish reason", async () => {
  const upstream = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      'data: {"choices":[{"delta":{"content":"antes"},"finish_reason":"stop"}]}\n\ndata: {"choices":[{"delta":{"content":"-depois"}}]}\n\n'
    );
  });
  await listen(upstream);
  try {
    const address = upstream.address();
    assert.ok(address && typeof address === "object");
    const events = [];
    await assert.rejects(async () => {
      for await (const event of createProvider(address.port).stream({
        requestId: "content-after-finish",
        model: "test-model",
        messages: [{ role: "user", content: "Oi" }]
      }))
        events.push(event);
    }, /choices after a terminal marker/u);
    assert.deepEqual(events, [{ type: "token", text: "antes" }]);
  } finally {
    await close(upstream);
  }
});

test("OpenAI-compatible provider rejects an invalid finish reason", async () => {
  const upstream = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      'data: {"choices":[{"delta":{"content":"resposta parcial"},"finish_reason":true}]}\n\n'
    );
  });
  await listen(upstream);
  try {
    const address = upstream.address();
    assert.ok(address && typeof address === "object");
    const events = [];
    await assert.rejects(async () => {
      for await (const event of createProvider(address.port).stream({
        requestId: "invalid-finish-reason",
        model: "test-model",
        messages: [{ role: "user", content: "Oi" }]
      }))
        events.push(event);
    }, /invalid finish_reason/u);
    assert.deepEqual(events, []);
  } finally {
    await close(upstream);
  }
});

test("OpenAI-compatible provider rejects invalid token content", async () => {
  const upstream = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      'data: {"choices":[{"delta":{"content":["array-token"]},"finish_reason":"stop"}]}\n\n'
    );
  });
  await listen(upstream);
  try {
    const address = upstream.address();
    assert.ok(address && typeof address === "object");
    const events = [];
    await assert.rejects(async () => {
      for await (const event of createProvider(address.port).stream({
        requestId: "invalid-content",
        model: "test-model",
        messages: [{ role: "user", content: "Oi" }]
      }))
        events.push(event);
    }, /invalid delta\.content/u);
    assert.deepEqual(events, []);
  } finally {
    await close(upstream);
  }
});

test("OpenAI-compatible provider rejects premature SSE EOF", async () => {
  const upstream = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      'data: {"choices":[{"delta":{"content":"resposta parcial"}}]}\n\n'
    );
  });
  await listen(upstream);
  try {
    const address = upstream.address();
    assert.ok(address && typeof address === "object");
    const provider = createProvider(address.port);
    const events = [];
    await assert.rejects(async () => {
      for await (const event of provider.stream({
        requestId: "truncated",
        model: "test-model",
        messages: [{ role: "user", content: "Oi" }]
      }))
        events.push(event);
    }, /without a terminal marker/u);
    assert.deepEqual(events, [{ type: "token", text: "resposta parcial" }]);
  } finally {
    await close(upstream);
  }
});

function createProvider(port) {
  return new OpenAiCompatibleProvider({
    id: "test-runtime",
    kind: "openai_compatible",
    label: "Test",
    endpoint: `http://127.0.0.1:${port}/v1`,
    local: true,
    backend: "cpu",
    capabilities: {
      streaming: true,
      structuredOutput: true,
      toolCalling: false,
      embeddings: false,
      vision: false
    },
    requestTimeoutMs: 2_000,
    maxStreamEventBytes: 1024
  });
}
