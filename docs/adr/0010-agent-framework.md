# ADR 0010 — Sem framework multiagente na Foundation

**Status:** aceito  
**Data:** 2026-09-03

## Problema

Preparar agentes sem introduzir loops opacos, lock-in ou dependências antes de existirem casos reais.

## Alternativas

Framework multiagente, graph workflow engine ou orchestrator próprio determinístico.

## Decisão

Começar com router/orchestrator explícito e poucos contratos. Reabrir a ADR se avaliações demonstrarem necessidade de checkpoint, fan-out ou workflows longos.

## Consequências

Maior auditabilidade e testes simples; alguns recursos futuros precisarão ser construídos ou adotados depois.
