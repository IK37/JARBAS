import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { JarbasConfig } from "@jarvis/contracts";

import { validateConfig } from "./validate-config.js";

type Environment = Readonly<Record<string, string | undefined>>;

async function readJson<T>(path: string): Promise<T> {
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Configuration file must contain an object: ${path}`);
  }
  return value as T;
}

function integerFromEnvironment(
  value: string | undefined,
  fallback: number
): number {
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
      readJson<
        Omit<
          JarbasConfig,
          | "runtimes"
          | "models"
          | "presets"
          | "hardwareProfiles"
          | "externalDataPolicy"
        >
      >(resolve(directory, "app.json")),
      readJson<Pick<JarbasConfig, "runtimes">>(
        resolve(directory, "runtimes.json")
      ),
      readJson<Pick<JarbasConfig, "models" | "presets">>(
        resolve(directory, "models.json")
      ),
      readJson<Pick<JarbasConfig, "hardwareProfiles">>(
        resolve(directory, "hardware.json")
      ),
      readJson<Pick<JarbasConfig, "externalDataPolicy">>(
        resolve(directory, "privacy.json")
      )
    ]);

  const config: JarbasConfig = {
    ...app,
    server: {
      ...app.server,
      host: environment.JARBAS_SERVER_HOST ?? app.server.host,
      port: integerFromEnvironment(
        environment.JARBAS_SERVER_PORT,
        app.server.port
      )
    },
    storage: {
      databasePath: environment.JARBAS_DATABASE_PATH ?? app.storage.databasePath
    },
    runtime: {
      ...app.runtime,
      defaultProviderId:
        environment.JARBAS_PROVIDER ?? app.runtime.defaultProviderId
    },
    routing: {
      preset:
        (environment.JARBAS_PRESET as
          JarbasConfig["routing"]["preset"] | undefined) ?? app.routing.preset
    },
    ...runtimeFile,
    ...modelFile,
    ...hardwareFile,
    ...privacyFile
  };

  validateConfig(config);
  return config;
}
