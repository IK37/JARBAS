export type ModelRole =
  | "fast"
  | "primary"
  | "reasoning"
  | "coding"
  | "embedding"
  | "reranking"
  | "vision";

export type ModelStatus = "candidate" | "stable" | "rejected" | "archived";

export interface ModelDefinition {
  readonly id: string;
  readonly runtimeModels: Readonly<Record<string, string>>;
  readonly roles: readonly ModelRole[];
  readonly parameterScale: string;
  readonly quantization: string;
  readonly contextWindow: number;
  readonly defaultContextTokens: number;
  readonly license: string;
  readonly source: string;
  readonly status: ModelStatus;
  readonly localBenchmarkStatus: "not_benchmarked" | "benchmarked";
}

export interface RuntimeCapabilities {
  readonly streaming: boolean;
  readonly structuredOutput: boolean;
  readonly toolCalling: boolean;
  readonly embeddings: boolean;
  readonly vision: boolean;
}

export interface RuntimeDefinition {
  readonly id: string;
  readonly kind: "mock" | "openai_compatible";
  readonly label: string;
  readonly endpoint?: string;
  readonly local: boolean;
  readonly backend: "auto" | "mock" | "cpu" | "vulkan" | "rocm" | "cuda" | "remote";
  readonly capabilities: RuntimeCapabilities;
  readonly requestTimeoutMs: number;
}

export interface ModelPreset {
  readonly id: "fast" | "balanced" | "quality" | "low_memory" | "offline";
  readonly routes: Readonly<Record<string, string>>;
}

export interface HardwareProfile {
  readonly id: string;
  readonly label: string;
  readonly phase: "current" | "future";
  readonly cpu: string;
  readonly gpu: string;
  readonly vramGb: number;
  readonly ramGb: number;
  readonly preferredBackends: readonly RuntimeDefinition["backend"][];
}

export interface ExternalDataRule {
  readonly classification:
    | "public"
    | "personal"
    | "private"
    | "secret"
    | "restricted";
  readonly defaultAction: "allow" | "confirm" | "deny";
  readonly externalAllowed: boolean;
}

export interface JarbasConfig {
  readonly server: {
    readonly host: string;
    readonly port: number;
    readonly allowedOrigins: readonly string[];
  };
  readonly storage: {
    readonly databasePath: string;
  };
  readonly runtime: {
    readonly defaultProviderId: string;
    readonly allowCpuFallback: boolean;
    readonly offline: boolean;
  };
  readonly routing: {
    readonly preset: ModelPreset["id"];
  };
  readonly observability: {
    readonly level: "debug" | "info" | "warn" | "error";
    readonly includeContent: false;
  };
  readonly runtimes: readonly RuntimeDefinition[];
  readonly models: readonly ModelDefinition[];
  readonly presets: readonly ModelPreset[];
  readonly hardwareProfiles: readonly HardwareProfile[];
  readonly externalDataPolicy: readonly ExternalDataRule[];
}
