# ADR 0003 — Fonte canônica e projeções derivadas

**Status:** aceito

**Data:** 2026-09-02

## Problema

Memória, FTS, vetores, grafo, resumos e datasets podem divergir durante correção, contradição e exclusão.

## Requisitos

- transações locais confiáveis e backup simples;
- auditoria de origem e evolução temporal;
- esquecimento propagado e verificável;
- pesquisa lexical, semântica e relacional sem múltiplas verdades;
- operação offline em Windows e Linux;
- migração futura sem contaminar o domínio com APIs de storage.

## Alternativas

1. Tratar cada storage como fonte independente.
2. Usar o vector store como fonte principal.
3. Manter uma fonte transacional canônica e projeções reconstruíveis.

## Comparação

| Opção                       | Consistência              | Operação local | Busca especializada | Complexidade |
| --------------------------- | ------------------------- | -------------- | ------------------- | ------------ |
| Stores independentes        | baixa                     | média          | alta                | muito alta   |
| Vector store canônico       | baixa para relações/tempo | média          | semântica forte     | alta         |
| SQLite canônico + projeções | alta                      | alta           | alta via projeções  | moderada     |

## Argumentos contrários

- SQLite pode exigir migração em sync multi-device ou alta concorrência.
- Rebuilds e outbox adicionam trabalho que um único banco especializado evitaria.
- Projeções podem ficar temporariamente atrasadas após uma mutação.

Esses custos são aceitos porque são observáveis e recuperáveis; divergência entre várias fontes autoritativas não é.

## Decisão

SQLite será o System of Record local nas fases iniciais. FTS, índices vetoriais, Knowledge Graph materializado, caches e resumos são projeções derivadas, associadas por IDs e hashes estáveis e reconstruíveis por jobs idempotentes.

## Motivo

Uma única verdade transacional simplifica auditoria, atualização temporal e esquecimento. Embeddings expressam similaridade, não veracidade.

## Consequências

- correções entram primeiro no store canônico;
- projeções precisam de versionamento, outbox e rebuild;
- exclusão precisa propagar e ser verificada;
- PostgreSQL poderá substituir SQLite por adapter quando houver gatilho real de escala/sync;
- vector store e banco de grafo não serão escolhidos antes dos benchmarks.
