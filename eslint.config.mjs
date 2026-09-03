import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/coverage/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      "scripts/**/*.mjs",
      "tests-runtime/**/*.mjs",
      "apps/web/scripts/**/*.mjs"
    ],
    languageOptions: {
      globals: {
        console: "readonly",
        fetch: "readonly",
        performance: "readonly",
        process: "readonly",
        TextDecoder: "readonly",
        URL: "readonly"
      }
    }
  },
  {
    files: ["apps/web/public/**/*.js"],
    languageOptions: {
      globals: {
        AbortController: "readonly",
        document: "readonly",
        fetch: "readonly",
        TextDecoder: "readonly"
      }
    }
  },
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error"
    }
  }
);
