import { createRuntime } from "./runtime.js";

const runtime = await createRuntime();
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  runtime.logger.log("info", "server.shutdown", { signal });
  await new Promise<void>((resolve, reject) =>
    runtime.server.close((error) => (error ? reject(error) : resolve()))
  );
  runtime.application.close();
  if (process.connected) process.disconnect();
}

function requestShutdown(signal: string): void {
  void shutdown(signal).catch((error: unknown) => {
    runtime.logger.log("error", "server.shutdown_failed", {
      signal,
      errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR"
    });
    process.exitCode = 1;
  });
}

process.once("SIGINT", () => requestShutdown("SIGINT"));
process.once("SIGTERM", () => requestShutdown("SIGTERM"));
process.once("message", (message: unknown) => {
  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "shutdown"
  ) {
    requestShutdown("IPC");
  }
});

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
