import { OpenAiCompatibleProvider } from "@jarvis/llm";

import {
  endpointIsLoopback,
  loadBenchmarkConfiguration
} from "./lib/benchmark-config.mjs";
import {
  buildBenchmarkReport,
  calculateThroughput,
  printBenchmarkSummary,
  probeRuntimeState,
  writeBenchmarkReport
} from "./lib/benchmark-report.mjs";

const config = await loadBenchmarkConfiguration();
const provider = new OpenAiCompatibleProvider({
  id: config.runtimeName,
  kind: "openai_compatible",
  label: `${config.runtimeName} benchmark endpoint`,
  endpoint: config.endpoint,
  local: endpointIsLoopback(config.endpoint),
  backend: readBackend(config.declaredHardware.backend),
  capabilities: {
    streaming: true,
    structuredOutput: false,
    toolCalling: false,
    embeddings: false,
    vision: false
  },
  requestTimeoutMs: config.requestTimeoutMs,
  maxStreamEventBytes: config.maxStreamEventBytes,
  maxStreamEvents: config.maxStreamEvents
});

const health = await provider.healthCheck();
const warmups = [];
for (let index = 0; index < config.warmupRuns; index += 1) {
  const testCase = config.suite.cases[index % config.suite.cases.length];
  warmups.push(
    await executeRun(testCase, index + 1, "warmup").catch((error) =>
      failedRun(testCase, index + 1, "warmup", error)
    )
  );
}

const results = [];
for (const testCase of config.suite.cases) {
  for (let run = 1; run <= config.measuredRuns; run += 1) {
    results.push(
      await executeRun(testCase, run, "measured").catch((error) =>
        failedRun(testCase, run, "measured", error)
      )
    );
  }
}

const runtimeState = await probeRuntimeState(config);
const report = buildBenchmarkReport({
  config,
  health,
  runtimeState,
  warmups,
  results
});
const outputPath = await writeBenchmarkReport(report, config.outputDirectory);
printBenchmarkSummary(report);
console.log(`Report: ${outputPath}`);

if (
  report.status.endsWith("FAILED") ||
  (config.runtimeName === "ollama" && report.acceptance.verdict !== "PASS")
) {
  process.exitCode = 1;
}

async function executeRun(testCase, run, phase) {
  const started = performance.now();
  let firstTokenAt;
  let output = "";
  let streamEvents = 0;
  let doneEvent;
  const controller = new AbortController();

  try {
    for await (const event of provider.stream({
      requestId: `${phase}-${testCase.id}-${run}`,
      model: config.model,
      messages: [{ role: "user", content: testCase.prompt }],
      temperature: config.suite.temperature,
      maxOutputTokens: config.suite.maxOutputTokens,
      reasoningEffort: config.reasoningEffort,
      signal: controller.signal
    })) {
      streamEvents += 1;
      if (streamEvents > config.maxStreamEvents) {
        controller.abort("Benchmark stream event limit exceeded");
        throw new Error(`${testCase.id}: stream event limit exceeded`);
      }
      if (event.type === "token") {
        firstTokenAt ??= performance.now();
        output += event.text;
        if (output.length > config.maxOutputCharacters) {
          controller.abort("Benchmark output character limit exceeded");
          throw new Error(`${testCase.id}: output character limit exceeded`);
        }
      } else {
        doneEvent = event;
      }
    }
  } finally {
    if (!controller.signal.aborted) controller.abort("Benchmark run complete");
  }

  if (!doneEvent) throw new Error(`${testCase.id}: missing done event`);
  if (!output.trim()) throw new Error(`${testCase.id}: empty visible response`);

  const finished = performance.now();
  const throughput = calculateThroughput(
    doneEvent.usage?.completionTokens,
    started,
    finished
  );
  return {
    status: "PASS",
    phase,
    id: testCase.id,
    category: testCase.category,
    run,
    ttftMs:
      firstTokenAt === undefined ? null : Math.round(firstTokenAt - started),
    durationMs: Math.round(finished - started),
    completionTokens: doneEvent.usage?.completionTokens ?? null,
    ...throughput,
    finishReason: doneEvent.finishReason,
    output
  };
}

function failedRun(testCase, run, phase, error) {
  return {
    status: "FAIL",
    phase,
    id: testCase.id,
    category: testCase.category,
    run,
    error: error instanceof Error ? error.message : "Unknown benchmark error"
  };
}

function readBackend(value) {
  const backends = new Set(["auto", "cpu", "vulkan", "rocm", "cuda", "remote"]);
  return backends.has(value) ? value : "auto";
}
