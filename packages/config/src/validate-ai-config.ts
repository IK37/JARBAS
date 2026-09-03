import type {
  ModelRole,
  ModelTask,
  RuntimeDefinition
} from "@jarvis/contracts";

import {
  array,
  boolean,
  enumValue,
  type JsonObject,
  nonEmptyString,
  object,
  positiveInteger,
  uniqueId
} from "./validation-primitives.js";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
export const modelTasks: readonly ModelTask[] = [
  "simple_conversation",
  "deep_reasoning",
  "coding",
  "memory_extraction",
  "summarization",
  "tool_selection"
];
export const presetIds = [
  "fast",
  "balanced",
  "quality",
  "low_memory",
  "offline"
] as const;
const modelRoles: readonly ModelRole[] = [
  "fast",
  "primary",
  "reasoning",
  "coding",
  "embedding",
  "reranking",
  "vision"
];
export const backends: readonly RuntimeDefinition["backend"][] = [
  "auto",
  "mock",
  "cpu",
  "vulkan",
  "rocm",
  "cuda",
  "remote"
];

interface AiValidationOptions {
  readonly activePreset: string;
  readonly defaultProviderId: string;
  readonly maxOutputTokens: number;
  readonly offline: boolean;
}

export function validateAiConfig(
  root: JsonObject,
  options: AiValidationOptions
): void {
  const runtimeMetadata = validateRuntimes(root.runtimes);
  const selectedRuntime = runtimeMetadata.get(options.defaultProviderId);
  if (!selectedRuntime) {
    throw new Error(`Unknown default runtime: ${options.defaultProviderId}`);
  }
  if (options.offline && !selectedRuntime.local) {
    throw new Error("Offline mode cannot select a remote runtime");
  }

  const models = validateModels(
    root.models,
    new Set(runtimeMetadata.keys()),
    options.maxOutputTokens
  );
  validatePresets(root.presets, models, options);
}

function validateRuntimes(
  value: unknown
): ReadonlyMap<string, { readonly local: boolean }> {
  const ids = new Set<string>();
  const metadata = new Map<string, { readonly local: boolean }>();
  for (const [index, candidate] of array(value, "runtimes").entries()) {
    const item = object(candidate, `runtimes[${index}]`);
    const id = uniqueId(item.id, `runtimes[${index}].id`, ids);
    const kind = enumValue(item.kind, `runtimes[${index}].kind`, [
      "mock",
      "openai_compatible"
    ] as const);
    nonEmptyString(item.label, `runtimes[${index}].label`);
    const local = boolean(item.local, `runtimes[${index}].local`);
    enumValue(item.backend, `runtimes[${index}].backend`, backends);
    positiveInteger(
      item.requestTimeoutMs,
      `runtimes[${index}].requestTimeoutMs`
    );
    positiveInteger(
      item.maxStreamEventBytes,
      `runtimes[${index}].maxStreamEventBytes`
    );
    validateCapabilities(item.capabilities, `runtimes[${index}].capabilities`);
    if (kind === "openai_compatible" && item.endpoint === undefined) {
      throw new Error(`Runtime ${id} requires an endpoint`);
    }
    if (item.endpoint !== undefined) {
      const endpoint = new URL(
        nonEmptyString(item.endpoint, `runtimes[${index}].endpoint`)
      );
      if (endpoint.username || endpoint.password) {
        throw new Error(`Runtime ${id} endpoint must not contain credentials`);
      }
      const hostname = endpoint.hostname.replace(/^\[|\]$/gu, "");
      if (local && !loopbackHosts.has(hostname)) {
        throw new Error(`Local runtime ${id} must use a loopback endpoint`);
      }
    }
    metadata.set(id, { local });
  }
  return metadata;
}

interface ModelMetadata {
  readonly runtimeIds: ReadonlySet<string>;
  readonly roles: ReadonlySet<string>;
}

function validateModels(
  value: unknown,
  runtimeIds: ReadonlySet<string>,
  maxOutputTokens: number
): ReadonlyMap<string, ModelMetadata> {
  const ids = new Set<string>();
  const metadata = new Map<string, ModelMetadata>();
  for (const [index, candidate] of array(value, "models").entries()) {
    const item = object(candidate, `models[${index}]`);
    const id = uniqueId(item.id, `models[${index}].id`, ids);
    const artifactIds = validateRuntimeModels(
      item.runtimeModels,
      id,
      runtimeIds
    );
    const roles = new Set(
      array(item.roles, `models[${index}].roles`).map((role, roleIndex) =>
        enumValue(role, `models[${index}].roles[${roleIndex}]`, modelRoles)
      )
    );
    if (roles.size === 0) throw new Error(`Model ${id} must have a role`);
    const contextWindow = positiveInteger(
      item.contextWindow,
      `models[${index}].contextWindow`
    );
    const defaultContextTokens = positiveInteger(
      item.defaultContextTokens,
      `models[${index}].defaultContextTokens`
    );
    if (defaultContextTokens + maxOutputTokens > contextWindow) {
      throw new Error(
        `Model ${id} context and output budgets exceed its window`
      );
    }
    for (const field of [
      "parameterScale",
      "quantization",
      "license"
    ] as const) {
      nonEmptyString(item[field], `models[${index}].${field}`);
    }
    new URL(nonEmptyString(item.source, `models[${index}].source`));
    enumValue(item.status, `models[${index}].status`, [
      "candidate",
      "stable",
      "rejected",
      "archived"
    ] as const);
    enumValue(
      item.localBenchmarkStatus,
      `models[${index}].localBenchmarkStatus`,
      ["not_benchmarked", "benchmarked"] as const
    );
    metadata.set(id, { runtimeIds: artifactIds, roles });
  }
  return metadata;
}

function validateRuntimeModels(
  value: unknown,
  modelId: string,
  knownRuntimes: ReadonlySet<string>
): ReadonlySet<string> {
  const runtimeModels = object(value, `models.${modelId}.runtimeModels`);
  const artifactIds = new Set<string>();
  for (const [runtimeId, artifact] of Object.entries(runtimeModels)) {
    if (!knownRuntimes.has(runtimeId)) {
      throw new Error(
        `Model ${modelId} references unknown runtime ${runtimeId}`
      );
    }
    nonEmptyString(artifact, `models.${modelId}.runtimeModels.${runtimeId}`);
    artifactIds.add(runtimeId);
  }
  if (artifactIds.size === 0) {
    throw new Error(
      `Model ${modelId} must define at least one runtime artifact`
    );
  }
  return artifactIds;
}

function validatePresets(
  value: unknown,
  models: ReadonlyMap<string, ModelMetadata>,
  options: AiValidationOptions
): void {
  const seen = new Set<string>();
  for (const [index, candidate] of array(value, "presets").entries()) {
    const item = object(candidate, `presets[${index}]`);
    const id = enumValue(item.id, `presets[${index}].id`, presetIds);
    if (seen.has(id)) throw new Error(`Duplicate preset id: ${id}`);
    seen.add(id);
    const routes = object(item.routes, `presets[${index}].routes`);
    for (const task of modelTasks) {
      const modelId = nonEmptyString(
        routes[task],
        `presets[${index}].routes.${task}`
      );
      const model = models.get(modelId);
      if (!model) {
        throw new Error(`Preset ${id} references unknown model ${modelId}`);
      }
      if (
        options.defaultProviderId !== "mock-local" &&
        !model.runtimeIds.has(options.defaultProviderId)
      ) {
        throw new Error(
          `Model ${modelId} has no artifact for selected runtime ${options.defaultProviderId}`
        );
      }
      validateTaskRole(task, modelId, model.roles);
    }
  }
  if (!seen.has(options.activePreset)) {
    throw new Error(`Unknown routing preset: ${options.activePreset}`);
  }
  for (const required of presetIds) {
    if (!seen.has(required))
      throw new Error(`Missing required preset: ${required}`);
  }
}

function validateCapabilities(value: unknown, path: string): void {
  const capabilities = object(value, path);
  for (const key of [
    "streaming",
    "structuredOutput",
    "toolCalling",
    "embeddings",
    "vision"
  ]) {
    boolean(capabilities[key], `${path}.${key}`);
  }
  if (capabilities.streaming !== true) {
    throw new Error(`${path}.streaming must be true for Foundation V1`);
  }
}

function validateTaskRole(
  task: ModelTask,
  modelId: string,
  roles: ReadonlySet<string>
): void {
  const required: Partial<Record<ModelTask, string>> = {
    deep_reasoning: "reasoning",
    coding: "coding"
  };
  const role = required[task];
  if (role && !roles.has(role)) {
    throw new Error(`Model ${modelId} lacks role ${role} required by ${task}`);
  }
  if (roles.has("embedding") || roles.has("reranking")) {
    throw new Error(
      `Non-generative model ${modelId} cannot route task ${task}`
    );
  }
}
