import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const directory = await mkdtemp(resolve(tmpdir(), "jarbas-smoke-"));
const port = await availablePort();
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["apps/api/dist/main.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    JARBAS_DATABASE_PATH: resolve(directory, "jarbas.db"),
    JARBAS_PROVIDER: "mock-local",
    JARBAS_SERVER_PORT: String(port)
  },
  stdio: ["ignore", "pipe", "pipe", "ipc"]
});
let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

try {
  const health = await pollJson(`${origin}/api/health`);
  assert(health.status === "healthy", "health endpoint must be healthy");

  const sessionResponse = await fetch(`${origin}/api/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ title: "Process smoke test" })
  });
  assert(sessionResponse.status === 201, "same-origin session creation failed");
  const session = await sessionResponse.json();

  const chatResponse = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ sessionId: session.id, content: "smoke real" })
  });
  assert(chatResponse.status === 200, "chat endpoint failed");
  const events = (await chatResponse.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert(events[0]?.type === "route", "chat route event missing");
  assert(events.at(-1)?.type === "done", "chat done event missing");

  const messagesResponse = await fetch(
    `${origin}/api/sessions/${session.id}/messages`
  );
  const messages = await messagesResponse.json();
  assert(messages.length === 2, "completed chat was not persisted");

  const missing = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ sessionId: "missing", content: "failure path" })
  });
  assert(missing.status === 404, "invalid session did not return HTTP 404");

  await requestShutdown(child);
  const exitCode = await waitForExit(child);
  assert(exitCode === 0, `server exited with code ${exitCode}`);
  process.stdout.write("JARBAS process smoke test passed\n");
} catch (error) {
  if (child.exitCode === null) child.kill();
  process.stderr.write(output);
  throw error;
} finally {
  await rm(directory, { recursive: true, force: true });
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object", "failed to allocate port");
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  return address.port;
}

async function pollJson(url) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server stopped before health check\n${output}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // The process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not become healthy\n${output}`);
}

function waitForExit(processHandle) {
  if (processHandle.exitCode !== null)
    return Promise.resolve(processHandle.exitCode);
  return new Promise((resolve, reject) => {
    processHandle.once("error", reject);
    processHandle.once("exit", resolve);
  });
}

function requestShutdown(processHandle) {
  return new Promise((resolve, reject) => {
    processHandle.send({ type: "shutdown" }, (error) =>
      error ? reject(error) : resolve()
    );
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
