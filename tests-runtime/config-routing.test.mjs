import assert from "node:assert/strict";
import { test } from "node:test";

import { ContextWindowManager } from "@jarvis/application";
import { validateConfig } from "@jarvis/config";
import { ModelRouter } from "@jarvis/routing";

import { testConfig } from "./helpers.mjs";

test("configuration validates a mock-local development override", async () => {
  const config = await testConfig();
  assert.equal(config.runtime.defaultProviderId, "mock-local");
  assert.equal(config.server.host, "127.0.0.1");
});

test("configuration validation rejects incomplete presets and unsafe policy", async () => {
  const missingRoute = structuredClone(await testConfig());
  delete missingRoute.presets[0].routes.coding;
  assert.throws(() => validateConfig(missingRoute), /routes\.coding/u);

  const unsafePolicy = structuredClone(await testConfig());
  unsafePolicy.externalDataPolicy.find(
    ({ classification }) => classification === "secret"
  ).externalAllowed = true;
  assert.throws(() => validateConfig(unsafePolicy), /must never/u);
});

test("model router keeps model identity separate from execution runtime", async () => {
  const route = new ModelRouter(await testConfig()).route("coding");
  assert.equal(route.modelId, "qwen35-9b-q4km");
  assert.equal(route.providerId, "mock-local");
  assert.equal(route.providerModel, route.modelId);
  assert.equal(route.inputTokenBudget, 32768);
  assert.equal(route.maxOutputTokens, 2048);
});

test("context window preserves recent complete turns", () => {
  const manager = new ContextWindowManager(1);
  const selection = manager.select(
    [
      { role: "user", content: "old" },
      { role: "assistant", content: "answer" },
      { role: "user", content: "new" }
    ],
    15
  );
  assert.deepEqual(selection.messages, [{ role: "user", content: "new" }]);
  assert.equal(selection.droppedMessages, 2);
});
