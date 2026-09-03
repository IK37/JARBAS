import type { JarbasConfig, LlmProvider } from "@jarvis/contracts";

import { MockProvider } from "./mock-provider.js";
import { OpenAiCompatibleProvider } from "./openai-compatible-provider.js";

export function createProviders(
  config: JarbasConfig
): ReadonlyMap<string, LlmProvider> {
  return new Map(
    config.runtimes.map((runtime): [string, LlmProvider] => {
      if (runtime.kind === "mock")
        return [runtime.id, new MockProvider(runtime.id)];
      const envKey = `JARBAS_${runtime.id.toUpperCase().replaceAll("-", "_")}_API_KEY`;
      return [
        runtime.id,
        new OpenAiCompatibleProvider(runtime, process.env[envKey])
      ];
    })
  );
}
