# DEVELOPMENT REPORT — Foundation V1

**Data:** 2026-09-03  
**Branch:** `feat/foundation-001`  
**Milestone:** Foundation V1

## Executive Summary

**DONE:** a JARBAS deixou de ser somente arquitetura e possui um baseline local executável: interface web, API loopback, chat em streaming, Model Router, providers substituíveis, persistência SQLite, observabilidade e health checks.

**DONE:** a MODEL & AI STACK REVIEW #001 foi registrada com recomendações separadas para AMD atual e NVIDIA futura.

**BLOCKED:** nenhum LLM foi executado na RX 9060 XT ou RTX 5070 Ti nesta sessão. O runner disponível não possui GPU nem runtime local; todos os candidatos permanecem `NOT BENCHMARKED LOCALLY`.

## Completed

- configuração central para aplicação, runtimes, modelos, hardware e privacidade;
- separação entre modelo lógico e backend de execução;
- providers mock e OpenAI-compatible com streaming SSE, timeout e health;
- presets FAST, BALANCED, QUALITY, LOW_MEMORY e OFFLINE;
- SQLite WAL com foreign keys, migration versionada e transações;
- sessões, mensagens e métricas persistentes;
- API Node local com NDJSON, cancelamento, limites e respostas seguras;
- interface web local sem lógica cognitiva;
- logs JSON com redação de credenciais;
- detector de hardware e harness de benchmark;
- documentação, ADRs e pipeline CI.

## Architecture Decisions

| ADR | Decisão | Motivo |
| --- | --- | --- |
| 0006 | Windows 11 diário; Ubuntu 24.04 para treino | matrizes oficiais e portabilidade AMD/NVIDIA |
| 0007 | modelo separado do runtime | migração de GPU sem reescrever o core |
| 0008 | web estática + API local na V1 | menor dependência e rápida validação |
| 0009 | SQLite canônico | integridade local sem infraestrutura prematura |
| 0010 | sem framework multiagente agora | auditabilidade e simplicidade |
| 0011 | shortlist permanece candidata | benchmark real obrigatório |

## Files Created

Principais grupos: `apps/api`, `apps/web`, `configs`, `packages/application`, `packages/config`, `packages/llm`, `packages/observability`, `packages/routing`, `packages/storage`, `benchmarks`, scripts e documentação.

## Files Modified

README, workspace/TypeScript, lockfile, ESLint, arquitetura, roadmap e contratos compartilhados.

## Models Tested

| Item | Resultado |
| --- | --- |
| MockProvider determinístico | LOCAL FOUNDATION TEST — passou |
| Protocolo OpenAI-compatible/SSE | LOCAL FOUNDATION TEST com servidor simulado — passou |
| Qwen3.5 4B/9B | NOT BENCHMARKED LOCALLY |
| Ministral 3 8B | NOT BENCHMARKED LOCALLY |
| Qwen3 Embedding/Reranker | NOT BENCHMARKED LOCALLY |

## Benchmarks

**DONE:** suite inicial versionada para português, JSON, tool selection, código e prompt injection.

**DONE:** harness registra TTFT, duração, tokens/s quando o runtime fornece usage e ambiente.

**BLOCKED:** tokens/s, VRAM, RAM do modelo e qualidade comparativa dependem da execução no PC do usuário.

## Tests

- 8 testes Vitest: domínio e Policy Engine;
- 7 testes de Foundation: config, router, restart SQLite, aplicação, SSE CRLF, HTTP/Origin e redação;
- total: 15 testes aprovados;
- TypeScript strict, ESLint, Prettier e build aprovados pelo GitHub Actions.

## Review Passes

### Review #1 — Correção técnica

Corrigidos parsing SSE com CRLF, status final sem evento terminal e `exactOptionalPropertyTypes` no cancelamento.

### Review #2 — Arquitetura e qualidade

Corrigidos root discovery ao iniciar via workspace, timeout de health, migration transacional e separação de artefato por runtime. Frameworks sem benefício imediato foram removidos.

### Review #3 — Segurança, regressão e polimento

Validado loopback, Origin, CSP, limites, ausência de secrets, redação sem ocultar métricas legítimas, restart do banco, suite completa e build no CI.

## Problems Found

- cache do pnpm inicializado cedo demais no CI;
- formatter/lint sem globals separados para browser e Node;
- Vitest descobria o harness nativo;
- sinal opcional violava typing estrito;
- caminho do repositório dependia do diretório corrente;
- redação inicial confundia contagem de tokens com segredo;
- health poderia aguardar timeout de geração.

## Problems Fixed

Todos os itens acima foram corrigidos e cobertos por gates ou testes aplicáveis.

## Known Limitations

- sem memória pessoal ainda; apenas persistência de conversa;
- sem embeddings, RAG, Knowledge Graph, agentes ou ferramentas executáveis;
- sem autenticação para uso fora de loopback;
- dados SQLite não possuem criptografia gerenciada;
- provider OpenAI-compatible ainda cobre somente chat/health;
- UI é funcional, não um desktop empacotado;
- performance de LLM real desconhecida.

## Technical Debt

- validação JSON estrutural deverá evoluir para schemas versionados;
- métricas de CPU/GPU precisam de coleta durante inferência;
- migrations futuras devem ser arquivos independentes;
- API precisará de testes de backpressure e desconexão prolongada.

## Security

**DONE:** local-only, CSP, allowlist de Origin, limites, timeouts, logs sem conteúdo e redação de secrets.

**PLANNED:** encryption at rest, ToolRegistry executável, sandbox, autenticação opcional e receipts de consentimento.

## Performance

Os 7 testes nativos terminaram em aproximadamente 0,15–0,17 s no ambiente sem GPU. Esse valor mede apenas foundation e não prevê desempenho de modelos.

## AMD Hardware Status

**DONE:** RX 9060 XT 16 GB está representada no perfil; runtimes `auto`, ROCm/Vulkan e fallback explícito são suportados pela arquitetura.

**BLOCKED:** instalar/validar Windows 11 ou Ubuntu 24.04, driver, Ollama/llama.cpp e executar benchmark real.

## NVIDIA Migration Readiness

**DONE:** perfil RTX 5070 Ti 16 GB e runtime CUDA configuráveis. Core, aplicação, storage e UI não dependem de fabricante.

**PLANNED:** detectar CUDA, repetir golden suite, comparar baseline AMD e só então alterar preset/modelo.

## Current Project Status

- Foundation V1: **100% DONE**;
- visão completa descrita no prompt mestre: **aproximadamente 10%**;
- milestone atual: pronto para Persistent Memory.

## Recommended Improvements

1. executar benchmark AMD com Qwen3.5 4B/9B e Ministral 3 8B;
2. implementar memória auditável com origem, privacidade e esquecimento;
3. adicionar backup/export antes de expandir o grafo;
4. integrar embedding somente após benchmark PT/EN/código;
5. adiar fine-tuning até evaluation/model registry.

## Next Steps

1. `pnpm hardware:detect` na máquina alvo;
2. instalar runtime compatível e baixar somente os três candidatos iniciais;
3. executar `pnpm benchmark:model` por runtime/modelo;
4. registrar resultados e selecionar `MODEL_FAST`/`MODEL_PRIMARY` provisórios;
5. iniciar Milestone 2 — Persistent Memory.
