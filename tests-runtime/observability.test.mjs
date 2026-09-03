import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";

import { redact } from "@jarvis/observability";

import { writeNdjson } from "../apps/api/dist/http-boundary.js";

test("observability redacts nested credentials and bearer values", () => {
  assert.deepEqual(
    redact({
      apiKey: "abc",
      promptTokens: 42,
      nested: { note: "Bearer secret-token" }
    }),
    {
      apiKey: "[REDACTED]",
      promptTokens: 42,
      nested: { note: "Bearer [REDACTED]" }
    }
  );
  assert.deepEqual(redact({ clientSecret: "value", cookie: "session=abc" }), {
    clientSecret: "[REDACTED]",
    cookie: "[REDACTED]"
  });
});

test("NDJSON backpressure fails fast when the client already disconnected", async () => {
  const response = new EventEmitter();
  response.destroyed = true;
  response.writableEnded = false;
  response.write = () => false;
  await assert.rejects(writeNdjson(response, { type: "token" }), {
    name: "AbortError"
  });
});
