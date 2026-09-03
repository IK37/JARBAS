# ADR 0009 — SQLite como storage canônico da Foundation

**Status:** aceito  
**Data:** 2026-09-03

## Problema

Persistir sessões e futuras memórias com integridade, migrations e operação local simples.

## Alternativas

Arquivos JSON, SQLite, PostgreSQL e bancos especializados separados.

## Decisão

SQLite em modo WAL, foreign keys, transações e migrations. Busca vetorial e Knowledge Graph serão projeções reconstruíveis, não novas fontes de verdade na V1.

## Consequências

Backup e instalação simples. Sync multiusuário ou alta concorrência poderão exigir PostgreSQL posteriormente.
