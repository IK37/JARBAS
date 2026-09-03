import { createRuntime } from "./runtime.js";

const runtime = await createRuntime();

async function shutdown(signal: string): Promise<void> {
  runtime.logger.log("info", "server.shutdown", { signal });
  await new Promise<void>((resolve, reject) =>
    runtime.server.close((error) => (error ? reject(error) : resolve()))
  );
  runtime.application.close();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await new Promise<void>((resolve, reject) => {
  runtime.server.once("error", reject);
  runtime.server.listen(
    runtime.config.server.port,
    runtime.config.server.host,
    resolve
  );
});
runtime.logger.log("info", "server.started", {
  host: runtime.config.server.host,
  port: runtime.config.server.port,
  providerId: runtime.config.runtime.defaultProviderId,
  preset: runtime.config.routing.preset,
  offline: runtime.config.runtime.offline
});
