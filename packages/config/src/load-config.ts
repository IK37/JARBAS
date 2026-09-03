import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { JarbasConfig } from "@jarvis/contracts";

import { validateConfig } from "./validate-config.js";

type Environment = Readonly<Record<string, string | undefined>>;

async function readJson(path: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Configuration file must contain an object: ${path}`);
  }
  return value as Record<string, unknown>;
}

function integerFromEnvironment(
  value: string | undefined,
  fallback: unknown
): unknown {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed))
    throw new Error(`Expected integer environment value, received: ${value}`);
  return parsed;
}

export async function loadConfig(
  directory = resolve(process.cwd(), "configs"),
  environment: Environment = process.env
): Promise<JarbasConfig> {
  const [app, runtimeFile, modelFile, hardwareFile, privacyFile] =
    await Promise.all([
      readJson(resolve(directory, "app.json")),
      readJson(resolve(directory, "runtimes.json")),
      readJson(resolve(directory, "models.json")),
      readJson(resolve(directory, "hardware.json")),
      readJson(resolve(directory, "privacy.json"))
    ]);

  const server = section(app.server, "app.server");
  const storage = section(app.storage, "app.storage");
  const runtime = section(app.runtime, "app.runtime");
  const routing = section(app.routing, "app.routing");
  const config: unknown = {
    ...app,
    server: {
      ...server,
      host: environment.JARBAS_SERVER_HOST ?? server.host,
      port: integerFromEnvironment(environment.JARBAS_SERVER_PORT, server.port)
    },
    storage: {
      ...storage,
      databasePath: environment.JARBAS_DATABASE_PATH ?? storage.databasePath
    },
    runtime: {
      ...runtime,
      defaultProviderId:
        environment.JARBAS_PROVIDER ?? runtime.defaultProviderId
    },
    routing: {
      ...routing,
      preset: environment.JARBAS_PRESET ?? routing.preset
    },
    runtimes: runtimeFile.runtimes,
    models: modelFile.models,
    presets: modelFile.presets,
    hardwareProfiles: hardwareFile.hardwareProfiles,
    externalDataPolicy: privacyFile.externalDataPolicy
  };

  validateConfig(config);
  return config;
}

function section(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}
