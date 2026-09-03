import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const endpoint =
  process.env.JARBAS_BENCH_ENDPOINT ?? "http://127.0.0.1:11434/v1";
const model = process.env.JARBAS_BENCH_MODEL;
if (!model)
  throw new Error("Set JARBAS_BENCH_MODEL before running the benchmark");

const suitePath =
  process.env.JARBAS_BENCH_SUITE ?? "benchmarks/model-stack-001.json";
const suite = JSON.parse(await readFile(resolve(suitePath), "utf8"));
const results = [];

for (const testCase of suite.cases) {
  const started = performance.now();
  let firstToken;
  let output = "";
  let completionTokens;
  const response = await fetch(
    `${endpoint.replace(/\/$/u, "")}/chat/completions`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: testCase.prompt }],
        stream: true,
        stream_options: { include_usage: true },
        temperature: suite.temperature,
        max_tokens: suite.maxOutputTokens
      })
    }
  );
  if (!response.ok || !response.body)
    throw new Error(`${testCase.id}: HTTP ${response.status}`);

  for await (const payload of parseSse(response.body)) {
    if (payload === "[DONE]") break;
    const chunk = JSON.parse(payload);
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) {
      firstToken ??= performance.now();
      output += text;
    }
    completionTokens = chunk.usage?.completion_tokens ?? completionTokens;
  }
  const finished = performance.now();
  results.push({
    id: testCase.id,
    category: testCase.category,
    ttftMs: firstToken === undefined ? null : Math.round(firstToken - started),
    durationMs: Math.round(finished - started),
    completionTokens: completionTokens ?? null,
    tokensPerSecond:
      completionTokens && firstToken !== undefined
        ? Number(
            (completionTokens / ((finished - firstToken) / 1000)).toFixed(2)
          )
        : null,
    output
  });
}

const report = {
  status: "LOCAL BENCHMARK",
  capturedAt: new Date().toISOString(),
  endpoint,
  model,
  suite: suite.suite,
  environment: {
    platform: process.platform,
    arch: process.arch,
    node: process.version
  },
  results
};
await mkdir("benchmark-results", { recursive: true });
const outputPath = resolve(
  "benchmark-results",
  `${suite.suite}-${Date.now()}.json`
);
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(outputPath);

async function* parseSse(stream) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const bytes of stream) {
    buffer += decoder.decode(bytes, { stream: true });
    buffer = buffer.replaceAll("\r\n", "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const event = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of event.split("\n")) {
        if (line.startsWith("data:") && line.slice(5).trim())
          yield line.slice(5).trim();
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}
