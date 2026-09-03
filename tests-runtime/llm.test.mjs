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
      'data: {"choices":[{"delta":{"content":"Olá "}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"mundo"},"finish_reason":"stop"}]}\r\n\r\ndata: [DONE]\r\n\r\n'
    );
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
    const health = await provider.healthCheck();
    assert.deepEqual(health.availableModels, ["test-model"]);
    let text = "";
    for await (const event of provider.stream({
      requestId: "r",
      model: "test-model",
      messages: [{ role: "user", content: "Oi" }]
    })) {
      if (event.type === "token") text += event.text;
    }
    assert.equal(text, "Olá mundo");
  } finally {
    await close(upstream);
  }
});
