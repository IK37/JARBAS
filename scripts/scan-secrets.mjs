import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ignored = new Set([
  "packages/observability/src/redact.ts",
  "scripts/scan-secrets.mjs"
]);
const tokenPattern = new RegExp(
  ["(?:\\bsk", "-|\\bgh[pousr]_", ")", "[A-Za-z0-9_-]{20,}"].join(""),
  "g"
);
const privateKeyMarker = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
const { stdout } = await execFileAsync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "buffer" }
);
const findings = [];

for (const path of stdout.toString("utf8").split("\0").filter(Boolean)) {
  if (ignored.has(path)) continue;
  let content;
  try {
    content = await readFile(path);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") continue;
    throw error;
  }
  if (content.includes(0)) continue;
  const text = content.toString("utf8");
  if (text.includes(privateKeyMarker) || tokenPattern.test(text)) {
    findings.push(path);
  }
  tokenPattern.lastIndex = 0;
}

if (findings.length > 0) {
  throw new Error(`Potential secrets found in: ${findings.join(", ")}`);
}
process.stdout.write("Tracked-file secret scan passed\n");
