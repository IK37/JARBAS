# Testing

Os gates são:

1. Prettier, ESLint e TypeScript strict;
2. testes de domínio, policy, config, router, SQLite, SSE, aplicação, HTTP e redação;
3. build e smoke test do processo real.

```bash
pnpm check
pnpm build
```

O harness nativo `pnpm test:runtime` existe para contingência e não substitui typecheck/lint. Modelos reais usam o plano versionado em `benchmarks/model-stack-001.json`.
