import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { resolve } from "node:path";

import { ContextWindowManager, JarbasApplication } from "@jarvis/application";
import { loadConfig } from "@jarvis/config";
import { JsonLogger } from "@jarvis/observability";
import { ModelRouter } from "@jarvis/routing";

export function testConfig(databasePath = ":memory:", environment = {}) {
  return loadConfig(resolve(process.cwd(), "configs"), {
    JARBAS_PROVIDER: "mock-local",
    JARBAS_DATABASE_PATH: databasePath,
    ...environment
  });
}

export function createApplication(config, store, provider, logs = []) {
  return new JarbasApplication(
    config,
    store,
    new Map([[provider.id, provider]]),
    new JsonLogger("debug", (line) => logs.push(JSON.parse(line))),
    new ModelRouter(config),
    new ContextWindowManager(config.generation.estimatedCharactersPerToken)
  );
}

export function providerWithStream(stream) {
  return {
    id: "mock-local",
    runtimeId: "mock-local",
    stream,
    async healthCheck() {
      return {
        status: "healthy",
        checkedAt: new Date().toISOString(),
        latencyMs: 0,
        availableModels: ["*"]
      };
    },
    async modelInfo(model) {
      return {
        providerId: "mock-local",
        runtimeId: "mock-local",
        model,
        local: true
      };
    }
  };
}

export function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}

export function close(server) {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}

export function disconnectAfterFirstChunk(port, body) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path: "/api/chat",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body)
        }
      },
      (response) => {
        let buffer = "";
        response.once("error", reject);
        const onData = (chunk) => {
          buffer += chunk.toString("utf8");
          const boundary = buffer.indexOf("\n");
          if (boundary < 0) return;
          response.off("data", onData);
          const event = JSON.parse(buffer.slice(0, boundary));
          response.destroy();
          resolve(event);
        };
        response.on("data", onData);
      }
    );
    request.once("error", reject);
    request.end(body);
  });
}

export async function waitUntil(predicate) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Condition not reached before timeout");
}

export function assertServerAddress(server) {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return address;
}
