import type { JarbasConfig } from "@jarvis/contracts";

import { presetIds, validateAiConfig } from "./validate-ai-config.js";
import { validatePlatformConfig } from "./validate-platform-config.js";
import {
  array,
  boolean,
  enumValue,
  integer,
  nonEmptyString,
  object,
  positiveInteger,
  positiveNumber,
  string
} from "./validation-primitives.js";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

export function validateConfig(
  config: unknown
): asserts config is JarbasConfig {
  const root = object(config, "config");
  validateServer(root.server);
  nonEmptyString(
    object(root.storage, "storage").databasePath,
    "storage.databasePath"
  );

  const runtime = object(root.runtime, "runtime");
  const defaultProviderId = nonEmptyString(
    runtime.defaultProviderId,
    "runtime.defaultProviderId"
  );
  const offline = boolean(runtime.offline, "runtime.offline");

  const generation = object(root.generation, "generation");
  const maxOutputTokens = positiveInteger(
    generation.maxOutputTokens,
    "generation.maxOutputTokens"
  );
  positiveInteger(
    generation.maxOutputCharacters,
    "generation.maxOutputCharacters"
  );
  positiveNumber(
    generation.estimatedCharactersPerToken,
    "generation.estimatedCharactersPerToken"
  );

  const activePreset = enumValue(
    object(root.routing, "routing").preset,
    "routing.preset",
    presetIds
  );
  validateObservability(root.observability);
  validateAiConfig(root, {
    activePreset,
    defaultProviderId,
    maxOutputTokens,
    offline
  });
  validatePlatformConfig(root);
}

function validateServer(value: unknown): void {
  const server = object(value, "server");
  const host = string(server.host, "server.host");
  if (!loopbackHosts.has(host)) {
    throw new Error(
      "JARBAS_SERVER_HOST must be a loopback address in Foundation V1"
    );
  }
  integer(server.port, "server.port", 1, 65_535);
  positiveInteger(server.maxRequestBodyBytes, "server.maxRequestBodyBytes");
  positiveInteger(server.maxMessageCharacters, "server.maxMessageCharacters");
  for (const [index, value] of array(
    server.allowedOrigins,
    "server.allowedOrigins"
  ).entries()) {
    const origin = new URL(string(value, `server.allowedOrigins[${index}]`));
    const hostname = origin.hostname.replace(/^\[|\]$/gu, "");
    if (origin.protocol !== "http:" || !loopbackHosts.has(hostname)) {
      throw new Error("Foundation origins must use HTTP on a loopback host");
    }
  }
}

function validateObservability(value: unknown): void {
  const observability = object(value, "observability");
  enumValue(observability.level, "observability.level", [
    "debug",
    "info",
    "warn",
    "error"
  ] as const);
  if (observability.includeContent !== false) {
    throw new Error("Content logging is disabled by security policy");
  }
}
