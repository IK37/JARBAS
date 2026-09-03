# Testing

Os gates são:

1. Prettier, ESLint e TypeScript strict;
2. testes de domínio, policy, config, router, janela de contexto, SQLite, SSE, aplicação, HTTP e redação;
3. build oficial, auditoria de dependências/secrets e smoke test do processo real.

```bash
pnpm check
pnpm test:coverage
pnpm security:scan
pnpm smoke
```

`pnpm test:runtime` cobre persistência entre reinícios, token usage, limites de saída, falha/cancelamento, exclusão mútua por sessão, SSE e a fronteira HTTP com códigos `400/403/404/413/415`. Ele roda contra o build oficial e não substitui typecheck/lint.

O smoke test cria um banco temporário, inicia `apps/api/dist/main.js`, usa a origem configurada como um navegador, conversa via NDJSON, verifica persistência e shutdown. Modelos reais usam o plano versionado em `benchmarks/model-stack-001.json` e permanecem `NOT BENCHMARKED LOCALLY` até execução no hardware-alvo.

A cobertura V8 possui threshold para as regras determinísticas exercitadas pelo Vitest (`domain` e `security`). Os módulos da Foundation são validados pela suíte nativa de integração e não são misturados artificialmente nesse percentual.
