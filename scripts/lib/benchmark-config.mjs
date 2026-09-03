import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const REASONING_EFFORTS = new Set(["none", "low", "medium", "high", "max"]);
const SAFE_SUITE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
const ACCEPTANCE_POLICY = Object.freeze({
  endpointScope: "LOCAL",
  minimumMeasuredRuns: 3,
  minimumWarmupRuns: 1,
  minimumGpuOffloadFraction: 0.95
});

export async function loadBenchmarkConfiguration(environment = process.env) {
  const endpoint = normalizeEndpoint(
    environment.JARBAS_BENCH_ENDPOINT ?? "http://127.0.0.1:11434/v1",
    environment.JARBAS_BENCH_ALLOW_REMOTE === "true"
  );
  const suitePath = resolve(
    environment.JARBAS_BENCH_SUITE ?? "benchmarks/model-stack-001.json"
  );
  const suiteText = await readFile(suitePath, "utf8");
  const suite = readSuite(JSON.parse(suiteText));
  const runtimeName =
    environment.JARBAS_BENCH_RUNTIME ?? inferRuntimeName(endpoint);
  return {
    endpoint,
    endpointScope: endpointIsLoopback(endpoint) ? "LOCAL" : "EXTERNAL",
    model: requiredEnvironment(environment, "JARBAS_BENCH_MODEL"),
    runtimeName,
    acceptancePolicy: ACCEPTANCE_POLICY,
    declaredHardware: {
      gpu: environment.JARBAS_BENCH_GPU ?? "unverified",
      backend: environment.JARBAS_BENCH_BACKEND ?? "unverified",
      evidence: "operator-provided"
    },
    measuredRuns: positiveInteger(environment, "JARBAS_BENCH_RUNS", 3, 10),
    warmupRuns: nonNegativeInteger(
      environment,
      "JARBAS_BENCH_WARMUP_RUNS",
      1,
      5
    ),
    requestTimeoutMs: positiveInteger(
      environment,
      "JARBAS_BENCH_TIMEOUT_MS",
      120_000,
      900_000
    ),
    maxStreamEventBytes: positiveInteger(
      environment,
      "JARBAS_BENCH_MAX_EVENT_BYTES",
      1_048_576,
      16_777_216
    ),
    maxStreamEvents: positiveInteger(
      environment,
      "JARBAS_BENCH_MAX_EVENTS",
      20_000,
      100_000
    ),
    maxOutputCharacters: positiveInteger(
      environment,
      "JARBAS_BENCH_MAX_OUTPUT_CHARACTERS",
      100_000,
      1_000_000
    ),
    minimumGpuOffloadFraction: readFraction(
      environment.JARBAS_BENCH_MIN_GPU_OFFLOAD_FRACTION,
      ACCEPTANCE_POLICY.minimumGpuOffloadFraction,
      "JARBAS_BENCH_MIN_GPU_OFFLOAD_FRACTION"
    ),
    reasoningEffort: readReasoningEffort(
      environment.JARBAS_BENCH_REASONING_EFFORT ??
        (runtimeName === "ollama" ? "none" : "default")
    ),
    outputDirectory: resolve(
      environment.JARBAS_BENCH_OUTPUT_DIR ?? "benchmark-results"
    ),
    suite: {
      ...suite,
      sha256: createHash("sha256").update(suiteText).digest("hex")
    }
  };
}

export function normalizeEndpoint(value, allowRemote = false) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("JARBAS_BENCH_ENDPOINT must use HTTP or HTTPS");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "JARBAS_BENCH_ENDPOINT must not contain credentials, query, or fragment"
    );
  }
  const hostname = url.hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  if (!allowRemote && !LOOPBACK_HOSTS.has(hostname)) {
    throw new Error(
      "Remote benchmark endpoints require JARBAS_BENCH_ALLOW_REMOTE=true"
    );
  }
  return url.href.replace(/\/$/u, "");
}

export function endpointIsLoopback(endpoint) {
  const hostname = new URL(endpoint).hostname
    .replace(/^\[|\]$/gu, "")
    .toLowerCase();
  return LOOPBACK_HOSTS.has(hostname);
}

export function readSuite(value) {
  const root = readObject(value, "benchmark suite");
  const id = typeof root.suite === "string" ? root.suite : undefined;
  if (!id || !SAFE_SUITE_ID.test(id)) {
    throw new Error(
      "suite.suite must be a filename-safe id with at most 64 characters"
    );
  }
  const version = readPositiveInteger(root.version, "suite.version");
  const temperature = readFiniteNumber(root.temperature, "suite.temperature");
  const maxOutputTokens = readPositiveInteger(
    root.maxOutputTokens,
    "suite.maxOutputTokens"
  );
  const cases = readArray(root.cases, "suite.cases").map((entry) => {
    const testCase = readObject(entry, "suite case");
    if (
      typeof testCase.id !== "string" ||
      typeof testCase.category !== "string" ||
      typeof testCase.prompt !== "string"
    ) {
      throw new Error("benchmark cases require id, category, and prompt");
    }
    return {
      id: testCase.id,
      category: testCase.category,
      prompt: testCase.prompt
    };
  });
  if (!cases.length) {
    throw new Error("benchmark suite requires at least one case");
  }
  return { id, version, temperature, maxOutputTokens, cases };
}

function inferRuntimeName(endpoint) {
  const port = new URL(endpoint).port;
  if (port === "11434") return "ollama";
  if (port === "8080") return "llama.cpp";
  return "unknown";
}

function requiredEnvironment(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Set ${name} before running the benchmark`);
  return value;
}

function positiveInteger(environment, name, fallback, maximum) {
  const value = environment[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return parsed;
}

function nonNegativeInteger(environment, name, fallback, maximum) {
  const value = environment[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 0 and ${maximum}`);
  }
  return parsed;
}

function readReasoningEffort(value) {
  if (value === "default") return undefined;
  if (!REASONING_EFFORTS.has(value)) {
    throw new Error(
      "JARBAS_BENCH_REASONING_EFFORT must be default, none, low, medium, high, or max"
    );
  }
  return value;
}

function readFraction(value, fallback, name) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    throw new Error(`${name} must be greater than 0 and at most 1`);
  }
  return parsed;
}

function readObject(value, field) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`invalid ${field}`);
  }
  return value;
}

function readArray(value, field) {
  if (!Array.isArray(value)) throw new Error(`invalid ${field}`);
  return value;
}

function readPositiveInteger(value, field) {
  const parsed = readFiniteNumber(value, field);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
  return parsed;
}

function readFiniteNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  return value;
}
