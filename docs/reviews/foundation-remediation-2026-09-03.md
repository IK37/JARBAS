# Foundation V1 — Triple Review and Remediation

**Data:** 2026-09-03
**Branch:** `feat/foundation-001`
**Escopo:** Foundation de chat local; Memory/RAG/Agents permanecem fora deste ciclo.

## Regra de execução

As três revisões iniciais ocorreram antes das alterações corretivas. Cada reviewer trabalhou em modo somente leitura, reproduziu falhas e emitiu veredicto independente. Após as correções, os mesmos três gates foram repetidos.

Os PASS descritos abaixo são resultados históricos de um ambiente incremental. Uma auditoria posterior de reprodutibilidade invalidou esses resultados como evidência de release; o incidente e a remediação estão registrados ao fim desta ata.

## Review #1 — Correção técnica

### Primeiro veredicto: FAIL

Falhas reproduzidas:

- origem real da UI recebia `403`;
- sessão inexistente/task inválida encerrava conexão após headers `200`;
- chats concorrentes intercalavam usuário/resposta;
- token usage era descartado;
- coverage não executava;
- smoke real e security scan não existiam no CI.

### Primeira re-review: FAIL

Os blockers originais foram corrigidos, mas testes adversariais encontraram:

- desconexão depois de `route` mantinha sessão bloqueada e mensagem órfã;
- usage com tipo/valor inválido podia concluir mensagens e falhar no SQLite;
- same-origin IPv6 construía URL inválida;
- coverage executava sem escopo ou threshold útil.

### Segunda correção

- `writeNdjson` passou a tratar `destroyed`, `writableEnded`, `close`, `error` e `drain` sem race conhecida;
- teste HTTP real desconecta após o primeiro chunk e verifica rollback, métrica e reutilização da sessão;
- usage é validado como safe integer não negativo no adapter e na application;
- IPv6 usa authority entre colchetes e a validação normaliza hostname;
- coverage foi limitada às regras unitárias exercitadas e ganhou thresholds;
- testes nativos foram divididos por módulo.

### Veredicto histórico: PASS, posteriormente invalidado para release

Evidências: frozen install, format, lint, strict typecheck, build de 11 projetos, 8 testes Vitest, 16 testes runtime, coverage 81,1%, audit, secret scan, smoke e diff-check aprovados.

## Review #2 — Arquitetura e qualidade

### Primeiro veredicto: FAIL

Falhas:

- application dependia de storage/logger/router concretos;
- `defaultContextTokens` não era aplicado;
- fallback era declarado, mas inexistente;
- configuração usava casts e validava apenas parte das referências.

### Correções

- portas de application injetadas pelo composition root;
- `ContextWindowManager` determinístico e observável;
- fallback fictício removido e mantido como `PLANNED`;
- validação estrutural e cross-file de runtimes, modelos, presets, roles, hardware e política;
- precedence de environment preservada com merge explícito;
- factory de LLM deixou de ler `process.env`;
- migrations/mappers e validadores divididos;
- porta de storage consolidada na camada application;
- build alternativo removido.

### Veredicto final: PASS

Não houve introdução de microserviço, framework, banco ou abstração sem necessidade.

## Review #3 — Regressão, segurança e polimento

### Primeiro veredicto: FAIL

Confirmou as falhas HTTP/Origin/concorrência/cancelamento e adicionou:

- resposta truncada era reutilizada como completa;
- ausência de backpressure e limites de evento/saída;
- External Data Policy e Policy Engine não estavam prontos para ferramentas;
- relatório declarava capacidades inexistentes.

### Correções

- respostas parciais são removidas em cancelamento, falha e disconnect;
- erro de runtime vira evento seguro e não expõe detalhe upstream;
- limites de body/mensagem/contexto/saída/SSE são configuráveis;
- backpressure e desconexão têm regressões automatizadas;
- same-origin legítima e origem hostil são cobertas;
- redação inclui secrets/cookies/JWTs e CI inclui audit/secret scan;
- smoke usa processo compilado e shutdown IPC portável;
- CI possui matriz Ubuntu e Windows;
- relatório diferencia `DONE`, `IN PROGRESS`, `PLANNED` e `BLOCKED`.

### Veredicto histórico: PASS no ambiente incremental

Frozen install, gates estáticos, 24 testes, coverage com thresholds, audit, secret scan, smoke por processo e regressões HTTP passaram. O merge permanece condicionado aos dois jobs remotos verdes.

## Autorrevisão

### O que esquecemos inicialmente?

O comportamento do navegador real, a semântica de turnos concorrentes, falhas após início do stream, dados externos malformados e o caminho de desconexão.

### O que ainda pode quebrar?

Crash abrupto do processo durante um turno, runtimes OpenAI-compatible com dialetos SSE diferentes e comportamento específico do driver/runtime AMD não disponível neste ambiente.

### Abordagem mais simples preservada

Um monólito local com um turno por sessão, portas explícitas e SQLite continua suficiente. Não foi criado um scheduler distribuído, event bus ou framework multiagente para resolver problemas que ainda não existem.

### Dívida preparada, não escondida

- fallback de runtime: `PLANNED`;
- Model/AMD benchmark: `BLOCKED EXTERNALLY`;
- Policy Engine executável: `EXPERIMENTAL`;
- Memory/RAG/Knowledge Graph: `NEXT`, não misturados na Foundation.

## Reproducibility Incident

### Symptom

Após instalação realmente limpa, os seis arquivos `tests-runtime/*.test.mjs` falharam antes dos testes com `ERR_MODULE_NOT_FOUND` para imports `@jarvis/*`.

### Immediate Cause

O harness executado pela raiz importava seis workspaces que não estavam declarados no `package.json` raiz.

### Root Cause

O fluxo antigo criava links manuais em `node_modules/@jarvis`. Esses links sobreviveram à remoção do script e mascararam dependências implícitas durante as validações incrementais.

### Why Tests Did Not Catch It

Os gates foram repetidos no mesmo diretório de trabalho. Embora o lockfile estivesse congelado, `node_modules` ainda continha estado que não seria criado em um checkout novo.

### Remediation

- declarar apenas os seis imports diretos como `devDependencies` `workspace:*` da raiz;
- tornar `test:runtime` responsável pelo próprio build;
- comparar imports do harness com o manifesto antes dos demais gates;
- aprovar nominalmente apenas o script de instalação do `esbuild`;
- executar coverage no CI Ubuntu e Windows;
- exigir a versão exata de pnpm declarada pelo projeto.

Um `node_modules` incremental que já continha `esbuild` ignorado falhou corretamente após `strictDepBuilds` ser ativado. A recuperação nominal com `corepack pnpm rebuild esbuild` removeu o estado residual; o clone limpo executou o mesmo postinstall automaticamente.

### Regression Prevention

O release passa a exigir Reproducibility Gate em checkout limpo, frozen lockfile, validação de dependências do harness e matriz remota completa. Links manuais, cache e `dist` anterior não são evidência válida.

### Verdict before SSE adversarial review

**Reproducibility Gate local: PASS.** Um clone Git sem `node_modules`, `dist`, coverage ou dados anteriores passou por frozen install, 8 testes Vitest, build de 11 projetos, 16 testes runtime, coverage, audit, secret scan, smoke e verificação de builds ignorados.

**Review #1: PASS.** O único achado LOW no checker foi corrigido com travessia recursiva, paths portáveis, suporte a `.js/.mjs/.cjs` e normalização de subpaths.

**Review #2: PASS.** O README e o nome do gate foram alinhados ao estado real e ao escopo runtime; a solução preserva as fronteiras arquiteturais sem criar um workspace desnecessário.

**Review #3: PASS / GO para commit local.** Testes adversariais preservaram loopback, Origin, limites, rollback, cancelamento e concorrência. O comando de instalação documentado também foi corrigido para ser portável entre shells.

**Commit/clone final: PASS.** O snapshot local imediatamente anterior a este relatório foi clonado do zero e repetiu frozen install, verificação de dependências, formatter, lint, typecheck, 24 testes, coverage, audit, secret scan, smoke e Git checks.

**Push: BLOCKED.** O push HTTPS autorizado não encontrou credencial GitHub no ambiente. O conector GitHub foi deliberadamente rejeitado como substituto de transporte porque recriaria commits com novos SHAs e deixaria os históricos local e remoto divergentes.

**CI da remediação: NOT RUN.** O remoto permanece em `1c2453b`; o CI #9 verde pertence ao estado anterior e não valida as correções atuais.

**Release: NO-GO** até preservar os commits locais no push e obter CI remoto verde em Ubuntu e Windows.

## SSE Terminal Integrity Re-review

Uma revisão adversarial posterior invalidou novamente o `Review #3: PASS` como evidência de release. O adapter OpenAI-compatible emitia `done/unknown` quando o upstream encerrava o stream após conteúdo parcial, mesmo sem `[DONE]` ou `finish_reason`. A application aceitava o evento terminal e persistia a resposta truncada.

### Root Cause

O adapter confundia EOF do transporte com conclusão semântica do protocolo. Além disso, `finish_reason` vinha de JSON externo por cast TypeScript, sem validação de tipo em runtime.

### Fix and Regression Prevention

- exigir `[DONE]` ou `finish_reason` explícito antes de emitir `done`;
- aceitar string desconhecida como `unknown`, mas rejeitar valores vazios ou de outro tipo;
- preservar usage que chegar após o chunk com `finish_reason`;
- testar `[DONE]` isolado, finish sem `[DONE]`, finish inválido e EOF prematuro;
- validar estruturalmente `choices`, `delta`, `content` e `usage` antes de emitir eventos;
- rejeitar conteúdo de token que não seja string;
- após `finish_reason`, aceitar apenas chunks sem choices para preservar usage e rejeitar conteúdo adicional;
- testar separadamente que a application remove o turno e registra métrica `failed` quando o provider termina sem evento terminal;
- normalizar `[::1]` na validação de endpoint local e cobrir com regressão;
- separar comandos Bash/Zsh e PowerShell na documentação de desenvolvimento.

### Current Revalidation

- Review #1 inicial: **FAIL** para `finish_reason` truthy de tipo inválido; narrowing adicionado;
- Review #2: **PASS arquitetural**, com TurnExecutor/atomicidade mantidos como dívida obrigatória antes de Memory;
- Review #3: correção funcional **PASS**, documentação **FAIL** antes desta atualização;
- worktree: 8 testes Vitest e 23 testes runtime aguardam revalidação após o hardening de estado terminal;
- clone limpo do novo snapshot: **PENDING**;
- release: **NO-GO** até re-reviews finais, clone limpo, commit, push e CI Ubuntu/Windows.
