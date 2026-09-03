# Testing

Os gates são:

1. Prettier, ESLint e TypeScript strict;
2. testes de domínio, policy, config, router, janela de contexto, SQLite, SSE, aplicação, HTTP e redação;
3. build oficial, auditoria de dependências/secrets e smoke test do processo real.

```bash
corepack pnpm check
corepack pnpm test:coverage
corepack pnpm security:scan
corepack pnpm smoke
```

`pnpm check:runtime-deps` compara imports `@jarvis/*` do harness runtime com as `devDependencies` da raiz. Isso impede que links residuais em `node_modules` escondam uma dependência não declarada.

`pnpm test:runtime` primeiro executa o build oficial e então cobre persistência entre reinícios, token usage, limites de saída, falha/cancelamento, exclusão mútua por sessão, SSE e a fronteira HTTP com códigos `400/403/404/413/415`. Ele não depende de `dist` anterior e não substitui typecheck/lint.

O smoke test cria um banco temporário, inicia `apps/api/dist/main.js`, usa a origem configurada como um navegador, conversa via NDJSON, verifica persistência e shutdown. Modelos reais usam o plano versionado em `benchmarks/model-stack-001.json` e permanecem `NOT BENCHMARKED LOCALLY` até execução no hardware-alvo.

A cobertura V8 possui threshold para as regras determinísticas exercitadas pelo Vitest (`domain` e `security`). Os módulos da Foundation são validados pela suíte nativa de integração e não são misturados artificialmente nesse percentual.

Release exige instalação limpa com frozen lockfile e todos os gates verdes nos dois sistemas do CI. Cache, symlink manual e build anterior não fazem parte do contrato de teste.
