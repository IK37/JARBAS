import type { JarbasConfig, LlmProvider } from "@jarvis/contracts";

import { MockProvider } from "./mock-provider.js";
import { OpenAiCompatibleProvider } from "./openai-compatible-provider.js";

export function createProviders(
  config: JarbasConfig,
  credentials: ReadonlyMap<string, string> = new Map()
): ReadonlyMap<string, LlmProvider> {
  return new Map(
    config.runtimes.map((runtime): [string, LlmProvider] => {
      if (runtime.kind === "mock")
        return [runtime.id, new MockProvider(runtime.id)];
      return [
        runtime.id,
        new OpenAiCompatibleProvider(runtime, credentials.get(runtime.id))
      ];
    })
  );
}
