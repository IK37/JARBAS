import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import {
  normalizeEndpoint,
  readSuite
} from "../scripts/lib/benchmark-config.mjs";
import {
  buildBenchmarkReport,
  calculateThroughput
} from "../scripts/lib/benchmark-report.mjs";
import { close, listen } from "./helpers.mjs";

const repositoryRoot = process.cwd();

test("hardware detector distinguishes system tools from runtime commands", async () => {
  const result = await runNode("scripts/detect-hardware.mjs");
  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(typeof report.capturedAt, "string");
  assert.equal(typeof report.systemBackendTools.rocminfo.available, "boolean");
  assert.equal(typeof report.runtimeCommands.ollama.available, "boolean");
  assert.match(report.notes[0], /does not prove or disprove/u);
  assert.equal("detectedBackends" in report, false);
});

test("benchmark configuration rejects remote, credentialed, and unsafe paths", () => {
  assert.throws(
    () => normalizeEndpoint("https://example.com/v1"),
    /require JARBAS_BENCH_ALLOW_REMOTE/u
  );
  assert.throws(
    () => normalizeEndpoint("http://token@127.0.0.1:11434/v1"),
    /must not contain credentials/u
  );
  assert.throws(
    () => normalizeEndpoint("http://127.0.0.1:11434/v1?token=secret"),
    /must not contain credentials/u
  );
  assert.throws(
    () =>
      readSuite({
        suite: "../escape",
        version: 1,
        temperature: 0,
        maxOutputTokens: 1,
        cases: [{ id: "x", category: "x", prompt: "x" }]
      }),
    /filename-safe/u
  );
});

test("benchmark calculates end-to-end throughput", () => {
  assert.deepEqual(calculateThroughput(5, 0, 1_000), {
    endToEndTokensPerSecond: 5
  });
});

test("benchmark labels an opted-in remote endpoint as external", () => {
  const report = buildBenchmarkReport({
    config: reportConfig("EXTERNAL"),
    health: { status: "healthy", availableModels: ["test-model"] },
    runtimeState: { status: "NOT APPLICABLE", models: [] },
    warmups: [],
    results: [measuredResult()]
  });
  assert.equal(report.status, "EXTERNAL BENCHMARK");
  assert.equal(report.acceptance.eligibility.status, "FAIL");
  assert.equal(report.acceptance.verdict, "FAIL");
});

test("benchmark repeats runs and records a validated terminal stream", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "jarbas-benchmark-"));
  const suitePath = join(temporaryDirectory, "suite.json");
  const outputDirectory = join(temporaryDirectory, "results");
  await writeFile(
    suitePath,
    JSON.stringify({
      suite: "test-suite",
      version: 1,
      temperature: 0,
      maxOutputTokens: 16,
      cases: [{ id: "exact", category: "test", prompt: "say ok" }]
    }),
    "utf8"
  );

  let chatRequests = 0;
  const server = createServer(async (request, response) => {
    if (request.url === "/v1/models") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: [{ id: "test-model" }] }));
      return;
    }
    if (request.url === "/v1/chat/completions") {
      const body = await readRequestBody(request);
      assert.equal(body.reasoning_effort, "none");
      chatRequests += 1;
      response.setHeader("content-type", "text/event-stream");
      response.write('data: {"choices":[{"delta":{"reasoning":"brief"}}]}\n\n');
      response.write(
        'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}],"usage":{"completion_tokens":2}}\n\n'
      );
      response.end("data: [DONE]\n\n");
      return;
    }
    response.statusCode = 404;
    response.end();
  });

  try {
    await listen(server);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const result = await runNode("scripts/benchmark-openai-compatible.mjs", {
      JARBAS_BENCH_ENDPOINT: `http://127.0.0.1:${address.port}/v1`,
      JARBAS_BENCH_MODEL: "test-model",
      JARBAS_BENCH_OUTPUT_DIR: outputDirectory,
      JARBAS_BENCH_RUNTIME: "test",
      JARBAS_BENCH_REASONING_EFFORT: "none",
      JARBAS_BENCH_RUNS: "3",
      JARBAS_BENCH_WARMUP_RUNS: "1",
      JARBAS_BENCH_SUITE: suitePath
    });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(chatRequests, 4);

    const files = await readdir(outputDirectory);
    assert.equal(files.length, 1);
    const report = JSON.parse(
      await readFile(join(outputDirectory, files[0]), "utf8")
    );
    assert.equal(report.status, "LOCAL BENCHMARK");
    assert.equal(report.acceptance.verdict, "NOT VERIFIED");
    assert.equal(report.configuration.measuredRuns, 3);
    assert.equal(report.configuration.warmupRuns, 1);
    assert.equal(report.results.length, 3);
    assert.ok(report.results.every(({ status }) => status === "PASS"));
    assert.ok(
      report.results.every(({ finishReason }) => finishReason === "stop")
    );
    assert.ok(report.results.every(({ output }) => output === "ok"));
    assert.equal(report.summaries[0].passed, 3);
    assert.equal(report.summaries[0].failed, 0);
  } finally {
    await close(server);
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("benchmark fails when warmup fails despite successful measured run", async () => {
  let chatRequests = 0;
  const server = createServer((request, response) => {
    if (request.url === "/v1/models") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: [{ id: "test-model" }] }));
      return;
    }
    chatRequests += 1;
    if (chatRequests === 1) {
      response.statusCode = 500;
      response.end("warmup failed");
      return;
    }
    validStream(response);
  });
  const execution = await runIsolatedBenchmark(server, {
    JARBAS_BENCH_WARMUP_RUNS: "1"
  });
  assert.equal(execution.result.code, 1);
  assert.equal(execution.report.status, "LOCAL BENCHMARK FAILED");
  assert.equal(execution.report.acceptance.execution, "FAIL");
});

test("benchmark rejects terminal streams with no visible response", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/v1/models") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: [{ id: "test-model" }] }));
      return;
    }
    response.setHeader("content-type", "text/event-stream");
    response.end("data: [DONE]\n\n");
  });
  const execution = await runIsolatedBenchmark(server);
  assert.equal(execution.result.code, 1);
  assert.equal(execution.report.status, "LOCAL BENCHMARK FAILED");
  assert.match(execution.report.results[0].error, /empty visible response/u);
});

test("benchmark fails when health does not list the target model", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/v1/models") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: [{ id: "different-model" }] }));
      return;
    }
    validStream(response);
  });
  const execution = await runIsolatedBenchmark(server);
  assert.equal(execution.result.code, 1);
  assert.equal(execution.report.acceptance.modelHealth, "FAIL");
});

test("Ollama benchmark proves VRAM residency without trusting device claims", async () => {
  const server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/v1/models") {
      response.end(JSON.stringify({ data: [{ id: "test-model" }] }));
      return;
    }
    if (request.url === "/api/ps") {
      response.end(
        JSON.stringify({
          models: [
            {
              name: "test-model",
              size: 4_000,
              size_vram: 3_900,
              context_length: 4_096,
              details: { quantization_level: "Q4_K_M" }
            }
          ]
        })
      );
      return;
    }
    validStream(response);
  });
  const execution = await runIsolatedBenchmark(server, {
    JARBAS_BENCH_RUNTIME: "ollama",
    JARBAS_BENCH_RUNS: "3",
    JARBAS_BENCH_WARMUP_RUNS: "1"
  });
  assert.equal(execution.result.code, 0, execution.result.stderr);
  assert.equal(execution.report.acceptance.hardwareAcceleration.status, "PASS");
  assert.deepEqual(execution.report.acceptance.hardwareAcceleration.evidence, [
    "ollama-api-ps-vram-residency"
  ]);
  assert.equal(
    execution.report.acceptance.hardwareAcceleration.deviceClaim.status,
    "NOT PROVIDED"
  );
  assert.equal(
    execution.report.acceptance.hardwareAcceleration.residency.fraction,
    0.975
  );
});

test("formal acceptance cannot weaken the benchmark protocol", () => {
  const config = {
    ...reportConfig("LOCAL"),
    runtimeName: "ollama",
    measuredRuns: 1,
    warmupRuns: 0,
    minimumGpuOffloadFraction: 0.01
  };
  const report = buildBenchmarkReport({
    config,
    health: { status: "healthy", availableModels: ["test-model"] },
    runtimeState: {
      status: "PASS",
      models: [
        {
          name: "test-model",
          sizeBytes: 4_000,
          sizeVramBytes: 4_000,
          contextLength: 4_096,
          quantization: "Q4_K_M"
        }
      ]
    },
    warmups: [],
    results: [measuredResult()]
  });
  assert.equal(report.acceptance.eligibility.status, "FAIL");
  assert.equal(report.acceptance.eligibility.reasons.length, 3);
  assert.equal(report.acceptance.verdict, "FAIL");
});

test("Ollama benchmark rejects insufficient GPU offload", async () => {
  const server = createOllamaServer({ size: 4_000, sizeVram: 400 });
  const execution = await runIsolatedBenchmark(server, {
    JARBAS_BENCH_RUNTIME: "ollama"
  });
  assert.equal(execution.result.code, 1);
  assert.equal(execution.report.acceptance.hardwareAcceleration.status, "FAIL");
  assert.equal(
    execution.report.acceptance.hardwareAcceleration.offload,
    "PARTIAL"
  );
  assert.equal(
    execution.report.acceptance.hardwareAcceleration.residency.fraction,
    0.1
  );
});

test("Ollama benchmark rejects missing throughput metrics", async () => {
  const server = createOllamaServer({
    size: 4_000,
    sizeVram: 4_000,
    includeUsage: false
  });
  const execution = await runIsolatedBenchmark(server, {
    JARBAS_BENCH_RUNTIME: "ollama"
  });
  assert.equal(execution.result.code, 1);
  assert.equal(execution.report.acceptance.metrics, "FAIL");
  assert.equal(execution.report.acceptance.verdict, "FAIL");
});

test("benchmark enforces aggregate event and output limits", async () => {
  const eventLimited = await runIsolatedBenchmark(
    createGenericServer((response) => validStream(response)),
    { JARBAS_BENCH_MAX_EVENTS: "1" }
  );
  assert.equal(eventLimited.result.code, 1);
  assert.match(eventLimited.report.results[0].error, /event count/u);

  const outputLimited = await runIsolatedBenchmark(
    createGenericServer((response) => validStream(response)),
    { JARBAS_BENCH_MAX_OUTPUT_CHARACTERS: "1" }
  );
  assert.equal(outputLimited.result.code, 1);
  assert.match(outputLimited.report.results[0].error, /character limit/u);
});

test("benchmark turns provider timeout into a failed report", async () => {
  const server = createGenericServer((response) => {
    setTimeout(() => validStream(response), 25);
  });
  const execution = await runIsolatedBenchmark(server, {
    JARBAS_BENCH_TIMEOUT_MS: "1"
  });
  assert.equal(execution.result.code, 1);
  assert.equal(execution.report.acceptance.execution, "FAIL");
});

function runNode(script, environment = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve(repositoryRoot, script)], {
      cwd: repositoryRoot,
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

async function runIsolatedBenchmark(server, environment = {}) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "jarbas-benchmark-"));
  const suitePath = join(temporaryDirectory, "suite.json");
  const outputDirectory = join(temporaryDirectory, "results");
  await writeFile(
    suitePath,
    JSON.stringify({
      suite: "test-suite",
      version: 1,
      temperature: 0,
      maxOutputTokens: 16,
      cases: [{ id: "exact", category: "test", prompt: "say ok" }]
    }),
    "utf8"
  );
  try {
    await listen(server);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const result = await runNode("scripts/benchmark-openai-compatible.mjs", {
      JARBAS_BENCH_ENDPOINT: `http://127.0.0.1:${address.port}/v1`,
      JARBAS_BENCH_MODEL: "test-model",
      JARBAS_BENCH_OUTPUT_DIR: outputDirectory,
      JARBAS_BENCH_RUNTIME: "test",
      JARBAS_BENCH_RUNS: "1",
      JARBAS_BENCH_WARMUP_RUNS: "0",
      JARBAS_BENCH_SUITE: suitePath,
      ...environment
    });
    const files = await readdir(outputDirectory);
    assert.equal(files.length, 1);
    const report = JSON.parse(
      await readFile(join(outputDirectory, files[0]), "utf8")
    );
    return { result, report };
  } finally {
    await close(server);
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

function validStream(response, includeUsage = true) {
  response.setHeader("content-type", "text/event-stream");
  response.end(
    `data: ${JSON.stringify({
      choices: [{ delta: { content: "ok" }, finish_reason: "stop" }],
      ...(includeUsage ? { usage: { completion_tokens: 2 } } : {})
    })}\n\ndata: [DONE]\n\n`
  );
}

function createGenericServer(respondToChat) {
  return createServer((request, response) => {
    if (request.url === "/v1/models") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: [{ id: "test-model" }] }));
      return;
    }
    respondToChat(response);
  });
}

function createOllamaServer({ size, sizeVram, includeUsage = true }) {
  return createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/v1/models") {
      response.end(JSON.stringify({ data: [{ id: "test-model" }] }));
      return;
    }
    if (request.url === "/api/ps") {
      response.end(
        JSON.stringify({
          models: [
            {
              name: "test-model",
              size,
              size_vram: sizeVram,
              context_length: 4_096,
              details: { quantization_level: "Q4_K_M" }
            }
          ]
        })
      );
      return;
    }
    validStream(response, includeUsage);
  });
}

function reportConfig(endpointScope) {
  return {
    endpoint: "https://example.com/v1",
    endpointScope,
    model: "test-model",
    runtimeName: "test",
    acceptancePolicy: {
      endpointScope: "LOCAL",
      minimumMeasuredRuns: 3,
      minimumWarmupRuns: 1,
      minimumGpuOffloadFraction: 0.95
    },
    declaredHardware: {
      gpu: "unverified",
      backend: "unverified",
      evidence: "operator-provided"
    },
    measuredRuns: 3,
    warmupRuns: 1,
    requestTimeoutMs: 1_000,
    maxStreamEvents: 10,
    maxOutputCharacters: 100,
    minimumGpuOffloadFraction: 0.95,
    reasoningEffort: undefined,
    suite: {
      id: "test-suite",
      version: 1,
      sha256: "test-hash",
      temperature: 0,
      maxOutputTokens: 16
    }
  };
}

function measuredResult() {
  return {
    status: "PASS",
    phase: "measured",
    id: "exact",
    category: "test",
    run: 1,
    ttftMs: 10,
    durationMs: 20,
    completionTokens: 2,
    endToEndTokensPerSecond: 100,
    finishReason: "stop",
    output: "ok"
  };
}

function readRequestBody(request) {
  return new Promise((resolvePromise, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.once("error", reject);
    request.once("end", () => {
      try {
        resolvePromise(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}
