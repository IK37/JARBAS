import { mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { stripTypeScriptTypes } from "node:module";

const root = process.cwd();
const projects = [
  "packages/contracts",
  "packages/config",
  "packages/domain",
  "packages/llm",
  "packages/observability",
  "packages/routing",
  "packages/security",
  "packages/storage",
  "packages/application",
  "apps/api",
];

for (const project of projects) {
  const sourceRoot = resolve(root, project, "src");
  const outputRoot = resolve(root, project, "dist");
  await rm(outputRoot, { recursive: true, force: true });
  await transformDirectory(sourceRoot, outputRoot);
}

const workspaceModules = resolve(root, "node_modules/@jarvis");
await mkdir(workspaceModules, { recursive: true });
for (const project of projects.filter((path) => path.startsWith("packages/"))) {
  const name = project.slice("packages/".length);
  const link = resolve(workspaceModules, name);
  await rm(link, { force: true, recursive: true });
  await symlink(resolve(root, project), link, "dir");
}

async function transformDirectory(sourceRoot, outputRoot) {
  for (const entry of await readdir(sourceRoot, { withFileTypes: true })) {
    const source = resolve(sourceRoot, entry.name);
    const target = resolve(outputRoot, entry.name.replace(/\.ts$/u, ".js"));
    if (entry.isDirectory()) {
      await transformDirectory(source, target);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    await mkdir(dirname(target), { recursive: true });
    const code = await readFile(source, "utf8");
    const transformed = stripTypeScriptTypes(code, {
      mode: "transform",
      sourceMap: false,
      sourceUrl: relative(root, source),
    });
    await writeFile(target, transformed, "utf8");
  }
}
