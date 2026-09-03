import { ContextWindowManager, JarbasApplication } from "@jarvis/application";
import { loadConfig } from "@jarvis/config";
import { createProviders } from "@jarvis/llm";
import { JsonLogger } from "@jarvis/observability";
import { ModelRouter } from "@jarvis/routing";
import { SqliteSessionStore } from "@jarvis/storage";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildServer } from "./build-server.js";

export async function createRuntime() {
  const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../.."
  );
  const config = await loadConfig(resolve(repositoryRoot, "configs"));
  const logger = new JsonLogger(config.observability.level);
  const databasePath = isAbsolute(config.storage.databasePath)
    ? config.storage.databasePath
    : resolve(repositoryRoot, config.storage.databasePath);
  const store = await SqliteSessionStore.open(databasePath);
  const credentials = new Map(
    config.runtimes.flatMap((runtime): [string, string][] => {
      const key = `JARBAS_${runtime.id.toUpperCase().replaceAll("-", "_")}_API_KEY`;
      const value = process.env[key];
      return value ? [[runtime.id, value]] : [];
    })
  );
  const providers = createProviders(config, credentials);
  const application = new JarbasApplication(
    config,
    store,
    providers,
    logger,
    new ModelRouter(config),
    new ContextWindowManager(config.generation.estimatedCharactersPerToken)
  );
  const server = buildServer(
    config,
    application,
    resolve(repositoryRoot, "apps/web/public")
  );
  return { config, logger, application, server };
}
