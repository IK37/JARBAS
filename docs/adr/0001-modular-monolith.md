# ADR 0001 — Monólito modular local-first

**Status:** aceito

**Data:** 2026-09-02

## Contexto

O sistema combinará memória, projetos, IA, ferramentas e integrações. Microserviços antecipados elevariam custo, latência e dificuldade de depuração antes de existir carga comprovada.

## Decisão

Usar monólito modular com contratos tipados e eventos de domínio. Módulos não importam adapters uns dos outros; dependem de portas. SQLite e fila persistente local atendem ao MVP.

## Consequências

- Desenvolvimento e testes mais simples.
- Execução local com baixa latência e maior privacidade.
- Fronteiras internas precisam ser fiscalizadas por lint e testes.
- Serviços poderão ser extraídos por contrato quando necessário.
