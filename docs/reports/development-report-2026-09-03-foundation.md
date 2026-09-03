# DEVELOPMENT REPORT — Foundation V1 Remediation

**Data:** 2026-09-03
**Branch:** `feat/foundation-001`
**Milestone:** Foundation V1 software baseline / Milestone 1 hardware acceptance

## Executive Summary

**PASS LOCAL / NO-GO REMOTO:** a Foundation possui implementação funcional, dependências workspace explícitas e validação reproduzível em clone limpo. A aceitação de software permanece aberta até o HEAD final ser publicado e passar no CI Ubuntu/Windows.

**DONE:** defeitos encontrados por revisões independentes foram reproduzidos e corrigidos: bloqueio da própria UI por Origin, erros depois dos headers, corrida de turnos, respostas parciais após cancelamento, EOF SSE prematuro, `finish_reason` inválido, perda de token usage, lock após desconexão, validação IPv6 loopback e gates incompletos.

**REPRODUCIBILITY PASS LOCAL — HEAD `17aa480`:** a versão documental pré-remediação, preservada na ref local de recuperação, não era reproduzível. Após corrigir as dependências implícitas e o EOF SSE, o snapshot commitado foi clonado sem `node_modules`, `dist`, coverage ou dados anteriores e passou por frozen install e todos os gates.

**PUSH PENDING AUTHORIZATION/CREDENTIAL:** o branch local ficará dez commits à frente de `origin/feat/foundation-001` após este registro final. Uma autorização anterior se referia a outro conjunto de commits, e o terminal também não possui credencial GitHub para Git nativo. O conector GitHub não foi usado para recriar commits via API porque isso produziria SHAs diferentes e divergência de histórico.

**REMOTE CI NOT VALIDATED:** o remoto permanece em `1c2453b`. O CI #9 está verde, mas pertence ao estado anterior e não constitui evidência para esta remediação. A aceitação continua `NO-GO` até o push e novos jobs Ubuntu/Windows verdes.

**IN PROGRESS:** o Milestone 1 completo ainda precisa carregar e executar um LLM real no computador-alvo.

**BLOCKED:** este ambiente não possui a RX 9060 XT nem runtime local configurado. Qwen3.5 4B/9B e Ministral 3 8B permanecem `NOT BENCHMARKED LOCALLY`.

## Completed

- configuração estrutural e cross-file para aplicação, runtimes, modelos, hardware e privacidade;
- separação entre modelo lógico, runtime e provider;
- portas de application para storage, logging e roteamento;
- providers mock e OpenAI-compatible com streaming SSE, timeout e health;
- Context Window Manager com orçamento por modelo e log de truncamento sem conteúdo;
- limites configuráveis para body, mensagem, contexto, saída e evento SSE;
- exclusão mútua por sessão com resposta `409`;
- rollback de mensagens incompletas em cancelamento, falha ou desconexão;
- SQLite WAL com foreign keys, migrations separadas e transações;
- sessões, mensagens e métricas com token usage persistente;
- API com validação JSON e respostas `400/403/404/409/413/415`;
- same-origin dinâmica para IPv4/IPv6 e porta configurada;
- backpressure e cancelamento em desconexão;
- interface web que reconcilia o histórico após sucesso, erro ou cancelamento;
- logs JSON com redação de headers/tokens/cookies/JWT/private keys;
- build oficial nos testes de integração;
- CI matricial Ubuntu/Windows, audit, secret scan e smoke de processo;
- cobertura V8 com thresholds para `domain` e `security`.

## Architecture Decisions

| ADR  | Decisão                                     | Motivo                                         |
| ---- | ------------------------------------------- | ---------------------------------------------- |
| 0006 | Windows 11 diário; Ubuntu 24.04 para treino | matrizes oficiais e portabilidade AMD/NVIDIA   |
| 0007 | modelo separado do runtime                  | migração de GPU sem reescrever o core          |
| 0008 | web estática + API local na V1              | menor dependência e rápida validação           |
| 0009 | SQLite canônico                             | integridade local sem infraestrutura prematura |
| 0010 | sem framework multiagente agora             | auditabilidade e simplicidade                  |
| 0011 | shortlist permanece candidata               | benchmark real obrigatório                     |

Decisões corretivas: um turno ativo por sessão na V1; falhas depois do início do stream viram eventos seguros; conteúdo parcial não integra o histórico; fallback automático foi removido da configuração até existir implementação observável.

## Files Created

- `packages/application/src/context-window-manager.ts`, `errors.ts` e `ports.ts`;
- validadores separados em `packages/config/src/validate-*.ts`;
- `packages/storage/src/migrations.ts` e `row-mappers.ts`;
- `apps/api/src/http-boundary.ts`;
- `scripts/smoke.mjs` e `scripts/scan-secrets.mjs`;
- `scripts/check-runtime-workspace-dependencies.mjs`;
- suítes de integração separadas em `tests-runtime/`.

## Files Modified

Configuração, contratos, application, API/UI, provider OpenAI-compatible, router, storage, observabilidade, scripts, CI, lockfile, documentação e roadmap.

## Models Tested

| Item                            | Resultado                                            |
| ------------------------------- | ---------------------------------------------------- |
| MockProvider determinístico     | LOCAL FOUNDATION TEST — passou                       |
| Protocolo OpenAI-compatible/SSE | LOCAL FOUNDATION TEST com servidor simulado — passou |
| Qwen3.5 4B/9B                   | NOT BENCHMARKED LOCALLY                              |
| Ministral 3 8B                  | NOT BENCHMARKED LOCALLY                              |
| Qwen3 Embedding/Reranker        | NOT BENCHMARKED LOCALLY                              |

## Benchmarks

**DONE:** plano e harness versionados para português, JSON, tool selection, código, prompt injection, TTFT e tokens/s.

**BLOCKED:** tokens/s, VRAM, RAM e qualidade comparativa de LLM exigem execução no hardware do usuário.

## Tests

- 8 testes Vitest de domínio e Policy Engine;
- 23 testes nativos de Foundation/integração no worktree atual;
- 31 cenários automatizados no total;
- cobertura unitária: 81,1% statements/lines, 66,66% branches e 100% functions no escopo `domain` + `security`;
- os resultados verdes anteriores ao incidente foram obtidos em ambiente incremental e permanecem apenas como histórico;
- o snapshot `17aa480` passou por clone Git limpo com os 31 testes, sem artefatos ou links residuais;
- smoke real: processo separado, health, same-origin, sessão, NDJSON, persistência, 404 e shutdown IPC.

## Review Passes

### Ciclo inicial

- Review #1 — correção técnica: **FAIL**;
- Review #2 — arquitetura e qualidade: **FAIL**;
- Review #3 — regressão, segurança e polimento: **FAIL**.

### Correções e re-review

- Review #1: blockers originais corrigidos; a primeira re-review encontrou lock residual em desconexão, usage inválido e IPv6; segunda correção e testes adicionados;
- Review #2: **PASS** após Dependency Inversion, Context Window Manager, validação configuracional e remoção do fallback fictício;
- Review #3: **PASS** no escopo local após regressões de disconnect, usage, IPv6, limites, audit e smoke.

A ata consolidada está em `docs/reviews/foundation-remediation-2026-09-03.md`.

### Reproducibility audit

- instalação limpa: **FAIL** na versão pré-remediação;
- causa: seis imports `@jarvis/*` do harness sem dependências declaradas na raiz;
- razão do falso-verde: links manuais residuais do fluxo antigo;
- remediação no worktree: **PASS** em clone Git limpo;
- Review #1 da remediação: **PASS**;
- Review #2 da remediação: **PASS**;
- Review #3 da remediação: **PASS / GO para commit local**;
- SHA local final da remediação: **PASS** em clone limpo;
- push: **BLOCKED** por ausência de credencial GitHub no terminal;
- CI da remediação: **NOT RUN**; o CI #9 verde pertence ao remoto antigo;
- release: **NO-GO** até push e CI Ubuntu/Windows da remediação.

### SSE terminal integrity re-review

- Review #3 adversarial: **FAIL** ao reproduzir EOF sem `[DONE]`/`finish_reason` persistido como resposta concluída;
- correção: o adapter exige marcador terminal explícito e rejeita tipo inválido em `finish_reason`;
- regressões: `[DONE]` isolado, `finish_reason` sem `[DONE]`, usage após finish, tipo inválido, EOF prematuro e rollback da application;
- IPv6: endpoint local `[::1]` agora é normalizado no validador de runtime;
- validação externa: o chunk SSE completo agora passa por narrowing estrutural antes de gerar eventos;
- estado terminal: choices posteriores ao `finish_reason` são rejeitadas; somente chunks sem choices podem complementar usage;
- Review #1 técnico: **PASS / GO**, após corrigir narrowing de `finish_reason`, conteúdo e estado pós-terminal;
- Review #2 arquitetura: **PASS / GO**, sem nova dependência, contrato ou vazamento de infraestrutura;
- Review #3 segurança/regressão/release: **PASS / GO**, após testes adversariais de terminal, usage, rollback e configuração;
- clone limpo de `17aa480`: **PASS**, com frozen install, 8 testes Vitest, 23 runtime, 11 builds, coverage, audit, secret scan e smoke;
- estado remoto: **NO-GO** até push autorizado e CI Ubuntu/Windows do novo SHA.

## Problems Found

- UI oficial rejeitava a própria origem;
- sessão/task inválida destruía a conexão depois do status `200`;
- dois chats simultâneos corrompiam a ordem semântica;
- cancelamento persistia resposta truncada como completa;
- token usage era descartado ou podia quebrar SQLite por tipo/overflow;
- todo o histórico ignorava o contexto configurado;
- `allowCpuFallback` existia sem implementação;
- validação usava casts e não cobria todas as referências;
- desconexão durante backpressure podia manter lock/mensagem órfã;
- URL IPv6 loopback era montada sem colchetes;
- build de teste alternativo divergia do release;
- coverage, audit, secret scan, smoke real e Windows CI estavam ausentes.
- dependências do harness root estavam implícitas e mascaradas por links residuais;
- coverage possuía threshold local, mas não era executada pelo CI;
- o lifecycle script do `esbuild` não possuía decisão versionada.
- EOF SSE sem marcador terminal era convertido em `done/unknown` e persistia conteúdo parcial;
- `finish_reason` externo não possuía narrowing em runtime;
- endpoint local IPv6 válido era rejeitado por comparação com hostname entre colchetes;
- README e DEVELOPMENT misturavam comandos POSIX com instruções destinadas também ao Windows.

## Problems Fixed

Os defeitos funcionais receberam correção e regressão automatizada aplicável. O hardening SSE e IPv6 passou por três revisões independentes e por clone limpo do commit `17aa480`. A aceitação permanece `NO-GO` somente no gate remoto até push autorizado e CI. O fallback não foi falsamente implementado: a flag e as alegações foram removidas, e a capacidade permanece `PLANNED`.

## Known Limitations

- nenhum LLM real foi carregado neste ambiente;
- sem fallback automático de runtime;
- sem memória pessoal; existe apenas histórico de conversa;
- sem embeddings, RAG, Knowledge Graph, agentes ou ferramentas executáveis;
- External Data Policy ainda é configuração declarativa, não enforcement por classificação;
- sem autenticação para rede ou criptografia at-rest gerenciada;
- exclusão mútua de sessão é in-process, adequada ao monólito V1;
- provider OpenAI-compatible ainda cobre chat/health;
- `providerId` e `runtimeId` compartilham identidade nesta implementação inicial.

## Technical Debt

- extrair o executor de turno antes de adicionar Memory ao `JarbasApplication`;
- modelar recuperação de turnos interrompidos por crash de processo;
- ampliar testes de slow client e eventos SSE malformados;
- separar view mínima de configuração consumida por application;
- endurecer o Policy Engine antes de qualquer ToolRegistry executável.

## Security

**DONE:** loopback, CSP, same-origin, tipos/limites HTTP, timeouts, backpressure, rollback de parciais, logs sem conteúdo, redação, audit e secret scan.

**PLANNED:** autenticação opcional, encryption at rest, enforcement da política externa, sandbox, ToolRegistry e consent receipts.

O Policy Engine é `EXPERIMENTAL` e não está aprovado para autorizar ferramentas reais.

## Performance

Os 23 testes de integração terminam em cerca de 0,20 s neste runner sem GPU. Isso mede apenas a Foundation. Não é previsão de desempenho de LLM.

## AMD Hardware Status

**DONE:** perfil Ryzen 5 9600X + RX 9060 XT 16 GB e runtimes desacoplados de fabricante.

**BLOCKED:** driver, Ollama/llama.cpp, backend efetivo, modelo, TTFT, tokens/s, RAM e VRAM não foram validados na máquina-alvo.

## NVIDIA Migration Readiness

**DONE:** perfil Ryzen 7 9800X3D + RTX 5070 Ti 16 GB e runtime CUDA configuráveis sem dependência no Core/Application/UI/Storage.

**PLANNED:** detectar CUDA, repetir golden suite, comparar baseline AMD e alterar apenas configuração/adapters.

## Current Project Status

- Foundation software baseline: **PASS LOCAL / NO-GO até push e CI Ubuntu/Windows do SHA final**;
- Milestone 1 com LLM real no hardware-alvo: **IN PROGRESS / BLOCKED EXTERNALLY**;
- visão completa do Prompt Mestre: **aproximadamente 10%**;
- próximo milestone de produto: Persistent Memory, após aceitação do runtime/modelo real.

## Recommended Improvements

1. executar benchmark AMD com Qwen3.5 4B/9B e Ministral 3 8B;
2. implementar fallback observável somente após validar um backend CPU real;
3. implementar memória auditável com origem, privacidade, deduplicação e esquecimento;
4. adicionar backup/export antes de expandir o grafo;
5. adiar fine-tuning até evaluation/model registry.

## Next Steps

1. revalidar Git hygiene e o clone limpo após este commit documental;
2. obter autorização explícita para o conjunto exato de commits e disponibilizar credencial ao Git nativo;
3. publicar e exigir CI verde em Ubuntu e Windows para o novo HEAD remoto;
4. executar `pnpm hardware:detect` na máquina-alvo;
5. instalar runtime AMD compatível e baixar apenas os candidatos iniciais;
6. executar `pnpm benchmark:model` por runtime/modelo;
7. registrar AMD baseline e selecionar `MODEL_FAST`/`MODEL_PRIMARY` provisórios;
8. aceitar formalmente o Milestone 1;
9. iniciar Persistent Memory com TurnExecutor e recuperação de turnos interrompidos.
