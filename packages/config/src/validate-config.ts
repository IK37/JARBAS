import type { JarbasConfig } from "@jarvis/contracts";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

export function validateConfig(config: JarbasConfig): void {
  if (!loopbackHosts.has(config.server.host)) {
    throw new Error(
      "JARBAS_SERVER_HOST must be a loopback address in Foundation V1"
    );
  }
  if (
    !Number.isInteger(config.server.port) ||
    config.server.port < 1 ||
    config.server.port > 65_535
  ) {
    throw new Error("Server port must be an integer between 1 and 65535");
  }
  if (config.observability.includeContent !== false) {
    throw new Error("Content logging is disabled by security policy");
  }

  const runtimeIds = new Set(config.runtimes.map((runtime) => runtime.id));
  if (!runtimeIds.has(config.runtime.defaultProviderId)) {
    throw new Error(
      `Unknown default runtime: ${config.runtime.defaultProviderId}`
    );
  }
  if (
    new Set(config.runtimes.map((runtime) => runtime.id)).size !==
    config.runtimes.length
  ) {
    throw new Error("Runtime ids must be unique");
  }
  for (const runtime of config.runtimes) {
    if (!runtime.endpoint) continue;
    const endpoint = new URL(runtime.endpoint);
    if (endpoint.username || endpoint.password) {
      throw new Error(
        `Runtime ${runtime.id} endpoint must not contain credentials`
      );
    }
    if (runtime.local && !loopbackHosts.has(endpoint.hostname)) {
      throw new Error(
        `Local runtime ${runtime.id} must use a loopback endpoint`
      );
    }
  }
  if (
    new Set(config.models.map((model) => model.id)).size !==
    config.models.length
  ) {
    throw new Error("Model ids must be unique");
  }

  const preset = config.presets.find(
    (candidate) => candidate.id === config.routing.preset
  );
  if (!preset) {
    throw new Error(`Unknown routing preset: ${config.routing.preset}`);
  }
  const modelIds = new Set(config.models.map((model) => model.id));
  for (const modelId of Object.values(preset.routes)) {
    if (!modelIds.has(modelId)) {
      throw new Error(
        `Preset ${preset.id} references unknown model ${modelId}`
      );
    }
  }

  const selectedRuntime = config.runtimes.find(
    (runtime) => runtime.id === config.runtime.defaultProviderId
  );
  if (config.runtime.offline && selectedRuntime?.local !== true) {
    throw new Error("Offline mode cannot select a remote runtime");
  }
}
