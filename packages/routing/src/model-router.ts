import type { JarbasConfig, ModelRoute, ModelTask } from "@jarvis/contracts";

export class ModelRouter {
  public constructor(private readonly config: JarbasConfig) {}

  public route(task: ModelTask): ModelRoute {
    const preset = this.config.presets.find(({ id }) => id === this.config.routing.preset);
    if (!preset) throw new Error(`Routing preset not found: ${this.config.routing.preset}`);

    const modelId = preset.routes[task];
    if (!modelId) throw new Error(`No model route configured for task: ${task}`);
    const model = this.config.models.find(({ id }) => id === modelId);
    if (!model) throw new Error(`Model not found: ${modelId}`);

    const providerId = this.config.runtime.defaultProviderId;
    const providerModel =
      model.runtimeModels[providerId] ?? (providerId === "mock-local" ? model.id : undefined);
    if (!providerModel) {
      throw new Error(`Model ${modelId} has no artifact configured for runtime ${providerId}`);
    }

    return {
      task,
      alias: `${this.config.routing.preset}:${task}`,
      modelId,
      providerId,
      providerModel,
      reason: `Preset ${this.config.routing.preset} maps ${task} to ${modelId}`,
    };
  }
}
