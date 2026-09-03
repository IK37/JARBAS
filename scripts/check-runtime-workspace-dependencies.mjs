import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageJsonUrl = new URL("../package.json", import.meta.url);
const runtimeTestsDirectory = fileURLToPath(
  new URL("../tests-runtime/", import.meta.url)
);
const importPattern =
  /(?:from\s+|import\s*(?:\(\s*)?)["'](@jarvis\/[^"']+)["']/g;

const packageJson = JSON.parse(await readFile(packageJsonUrl, "utf8"));
const runtimeTestFiles = (
  await readdir(runtimeTestsDirectory, { recursive: true })
).filter((file) => /\.(?:c|m)?js$/.test(file));
const importedWorkspaces = new Set();

for (const file of runtimeTestFiles) {
  const contents = await readFile(resolve(runtimeTestsDirectory, file), "utf8");

  for (const match of contents.matchAll(importPattern)) {
    importedWorkspaces.add(match[1].split("/").slice(0, 2).join("/"));
  }
}

const invalidDependencies = [...importedWorkspaces]
  .sort()
  .filter(
    (packageName) =>
      packageJson.devDependencies?.[packageName] !== "workspace:*"
  );

if (invalidDependencies.length > 0) {
  throw new Error(
    `Runtime test workspace imports must be root devDependencies using workspace:*: ${invalidDependencies.join(
      ", "
    )}`
  );
}

console.log(
  `Runtime test workspace dependencies are explicit (${importedWorkspaces.size} checked).`
);
