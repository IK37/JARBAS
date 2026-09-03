import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/domain/src/**/*.ts", "packages/security/src/**/*.ts"],
      exclude: ["**/index.ts"],
      thresholds: {
        statements: 75,
        branches: 35,
        functions: 100,
        lines: 75
      }
    }
  }
});
