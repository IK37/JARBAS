import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { cpus, platform, release, totalmem } from "node:os";
import { resolve } from "node:path";

export function buildBenchmarkReport({
  config,
  health,
  runtimeState,
  warmups,
  results
}) {
  const failedExecutions = [...warmups, ...results].filter(
    ({ status }) => status === "FAIL"
  );
  const targetListed = health.availableModels?.includes(config.model) ?? false;
  const executionStatus = failedExecutions.length ? "FAIL" : "PASS";
  const modelHealthStatus =
    health.status === "healthy" && targetListed ? "PASS" : "FAIL";
  const metricsStatus = hasRequiredMetrics(results) ? "PASS" : "FAIL";
  const eligibility = evaluateAcceptanceEligibility(config);
  const hardwareVerification = verifyHardware(
    config,
    runtimeState,
    executionStatus,
    modelHealthStatus
  );
  const benchmarkLabel = `${config.endpointScope} BENCHMARK`;
  const benchmarkStatus =
    executionStatus === "PASS" &&
    modelHealthStatus === "PASS" &&
    metricsStatus === "PASS"
      ? benchmarkLabel
      : `${benchmarkLabel} FAILED`;

  return {
    status: benchmarkStatus,
    acceptance: {
      execution: executionStatus,
      modelHealth: modelHealthStatus,
      metrics: metricsStatus,
      eligibility,
      hardwareAcceleration: hardwareVerification,
      verdict:
        executionStatus !== "PASS" ||
        modelHealthStatus !== "PASS" ||
        metricsStatus !== "PASS" ||
        eligibility.status !== "PASS"
          ? "FAIL"
          : hardwareVerification.status === "PASS"
            ? "PASS"
            : "NOT VERIFIED"
    },
    capturedAt: new Date().toISOString(),
    endpoint: config.endpoint,
    model: config.model,
    suite: {
      id: config.suite.id,
      version: config.suite.version,
      sha256: config.suite.sha256,
      temperature: config.suite.temperature,
      maxOutputTokens: config.suite.maxOutputTokens
    },
    configuration: {
      measuredRuns: config.measuredRuns,
      warmupRuns: config.warmupRuns,
      requestTimeoutMs: config.requestTimeoutMs,
      reasoningEffort: config.reasoningEffort,
      maxStreamEvents: config.maxStreamEvents,
      maxOutputCharacters: config.maxOutputCharacters,
      minimumGpuOffloadFraction: config.minimumGpuOffloadFraction,
      acceptancePolicy: config.acceptancePolicy,
      declaredHardware: config.declaredHardware
    },
    environment: {
      platform: platform(),
      release: release(),
      arch: process.arch,
      node: process.version,
      cpu: cpus()[0]?.model ?? "unknown",
      logicalCores: cpus().length,
      totalRamGb: Number((totalmem() / 1024 ** 3).toFixed(2))
    },
    runtime: {
      name: config.runtimeName,
      version: probeRuntimeVersion(config.runtimeName),
      health,
      state: runtimeState
    },
    warmups,
    results,
    summaries: summarize(results)
  };
}

export async function probeRuntimeState(config) {
  if (config.runtimeName !== "ollama") {
    return { status: "NOT APPLICABLE", models: [] };
  }
  try {
    const url = new URL(config.endpoint);
    const response = await fetch(`${url.origin}/api/ps`, {
      signal: globalThis.AbortSignal.timeout(
        Math.min(config.requestTimeoutMs, 10_000)
      ),
      redirect: "error"
    });
    if (!response.ok) {
      return { status: "FAIL", httpStatus: response.status, models: [] };
    }
    const body = readObject(await response.json(), "runtime state");
    const models = readArray(body.models, "runtime models");
    return {
      status: "PASS",
      models: models.map((item) => readRuntimeModel(item))
    };
  } catch (error) {
    return {
      status: "FAIL",
      error:
        error instanceof Error ? error.message : "Unknown runtime state error",
      models: []
    };
  }
}

export function calculateThroughput(completionTokens, startedAt, finishedAt) {
  if (!completionTokens || completionTokens < 1) {
    return { endToEndTokensPerSecond: null };
  }
  const totalSeconds = Math.max((finishedAt - startedAt) / 1000, 0.001);
  return {
    endToEndTokensPerSecond: Number(
      (completionTokens / totalSeconds).toFixed(2)
    )
  };
}

export async function writeBenchmarkReport(report, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = resolve(
    outputDirectory,
    `${report.suite.id}-${Date.now()}.json`
  );
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return outputPath;
}

export function printBenchmarkSummary(report) {
  console.table(
    report.summaries.map((summary) => ({
      case: summary.id,
      pass: summary.passed,
      fail: summary.failed,
      "TTFT p50 ms": summary.medianTtftMs,
      "duration p50 ms": summary.medianDurationMs,
      "end-to-end tok/s": summary.medianEndToEndTokensPerSecond
    }))
  );
  console.log(`Execution: ${report.acceptance.execution}`);
  console.log(`Model health: ${report.acceptance.modelHealth}`);
  console.log(`Required metrics: ${report.acceptance.metrics}`);
  console.log(
    `Acceptance eligibility: ${report.acceptance.eligibility.status}`
  );
  console.log(
    `Hardware acceleration: ${report.acceptance.hardwareAcceleration.status}`
  );
  console.log(`Acceptance evidence: ${report.acceptance.verdict}`);
}

function verifyHardware(config, runtimeState, executionStatus, healthStatus) {
  if (executionStatus !== "PASS" || healthStatus !== "PASS") {
    return { status: "FAIL", reason: "Execution or model health failed" };
  }
  if (config.runtimeName !== "ollama") {
    return {
      status: "NOT VERIFIED",
      reason: "No runtime-specific GPU probe is implemented"
    };
  }
  const residentModel = runtimeState.models.find(
    ({ name }) => name === config.model
  );
  if (runtimeState.status !== "PASS" || !residentModel) {
    return {
      status: "FAIL",
      reason: "Ollama did not report the target model resident in VRAM"
    };
  }
  if (
    !residentModel.sizeBytes ||
    residentModel.sizeBytes <= 0 ||
    !residentModel.sizeVramBytes ||
    residentModel.sizeVramBytes <= 0
  ) {
    return {
      status: "FAIL",
      reason: "Ollama did not report usable model and VRAM sizes"
    };
  }
  const rawOffloadFraction =
    residentModel.sizeVramBytes / residentModel.sizeBytes;
  const reportedOffloadFraction = Math.min(rawOffloadFraction, 1);
  if (rawOffloadFraction < config.minimumGpuOffloadFraction) {
    return {
      status: "FAIL",
      reason: "GPU offload is below the configured acceptance threshold",
      offload: "PARTIAL",
      minimumGpuOffloadFraction: config.minimumGpuOffloadFraction,
      residency: {
        sizeVramBytes: residentModel.sizeVramBytes,
        sizeBytes: residentModel.sizeBytes,
        fraction: reportedOffloadFraction
      }
    };
  }
  return {
    status: "PASS",
    reason: "Ollama reports the target model resident in GPU memory",
    evidence: ["ollama-api-ps-vram-residency"],
    offload: "ACCEPTED",
    minimumGpuOffloadFraction: config.minimumGpuOffloadFraction,
    residency: {
      sizeVramBytes: residentModel.sizeVramBytes,
      sizeBytes: residentModel.sizeBytes,
      fraction: reportedOffloadFraction
    },
    deviceClaim: {
      status:
        config.declaredHardware.gpu === "unverified" &&
        config.declaredHardware.backend === "unverified"
          ? "NOT PROVIDED"
          : "OPERATOR DECLARED",
      gpu: config.declaredHardware.gpu,
      backend: config.declaredHardware.backend,
      evidence: config.declaredHardware.evidence
    }
  };
}

function summarize(results) {
  const groups = new Map();
  for (const result of results) {
    const group = groups.get(result.id) ?? [];
    group.push(result);
    groups.set(result.id, group);
  }
  return [...groups.entries()].map(([id, runs]) => {
    const passed = runs.filter((run) => run.status === "PASS");
    return {
      id,
      category: runs[0]?.category ?? "unknown",
      passed: passed.length,
      failed: runs.length - passed.length,
      medianTtftMs: median(passed.map((run) => run.ttftMs)),
      medianDurationMs: median(passed.map((run) => run.durationMs)),
      medianEndToEndTokensPerSecond: median(
        passed.map((run) => run.endToEndTokensPerSecond)
      )
    };
  });
}

function hasRequiredMetrics(results) {
  return (
    results.length > 0 &&
    results.every(
      (result) =>
        result.status === "PASS" &&
        typeof result.ttftMs === "number" &&
        Number.isFinite(result.ttftMs) &&
        result.ttftMs >= 0 &&
        typeof result.endToEndTokensPerSecond === "number" &&
        Number.isFinite(result.endToEndTokensPerSecond) &&
        result.endToEndTokensPerSecond > 0
    )
  );
}

function evaluateAcceptanceEligibility(config) {
  const reasons = [];
  if (config.endpointScope !== config.acceptancePolicy.endpointScope) {
    reasons.push("Formal acceptance requires a local endpoint");
  }
  if (config.measuredRuns < config.acceptancePolicy.minimumMeasuredRuns) {
    reasons.push(
      `Formal acceptance requires at least ${config.acceptancePolicy.minimumMeasuredRuns} measured runs`
    );
  }
  if (config.warmupRuns < config.acceptancePolicy.minimumWarmupRuns) {
    reasons.push(
      `Formal acceptance requires at least ${config.acceptancePolicy.minimumWarmupRuns} warmup run`
    );
  }
  if (
    config.minimumGpuOffloadFraction <
    config.acceptancePolicy.minimumGpuOffloadFraction
  ) {
    reasons.push(
      `Formal acceptance requires a GPU offload threshold of at least ${config.acceptancePolicy.minimumGpuOffloadFraction}`
    );
  }
  return {
    status: reasons.length ? "FAIL" : "PASS",
    reasons
  };
}

function median(values) {
  const numeric = values
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (!numeric.length) return null;
  const middle = Math.floor(numeric.length / 2);
  return numeric.length % 2
    ? numeric[middle]
    : Number(((numeric[middle - 1] + numeric[middle]) / 2).toFixed(2));
}

function probeRuntimeVersion(name) {
  const command = new Map([
    ["ollama", ["ollama", ["--version"]]],
    ["llama.cpp", ["llama-server", ["--version"]]]
  ]).get(name);
  if (!command) return "NOT PROBED";
  const result = spawnSync(command[0], command[1], {
    encoding: "utf8",
    timeout: 5_000
  });
  if (result.status !== 0) return "unavailable";
  return `${result.stdout}${result.stderr}`.trim() || "unknown";
}

function readRuntimeModel(value) {
  const entry = readObject(value, "runtime model");
  const details = entry.details
    ? readObject(entry.details, "runtime model details")
    : undefined;
  return {
    name: typeof entry.name === "string" ? entry.name : "unknown",
    sizeBytes: nonNegativeIntegerOrNull(entry.size, "runtime model size"),
    sizeVramBytes: nonNegativeIntegerOrNull(
      entry.size_vram,
      "runtime model VRAM size"
    ),
    contextLength: nonNegativeIntegerOrNull(
      entry.context_length,
      "runtime model context length"
    ),
    quantization:
      typeof details?.quantization_level === "string"
        ? details.quantization_level
        : "unknown"
  };
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

function nonNegativeIntegerOrNull(value, field) {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid ${field}`);
  }
  return value;
}
