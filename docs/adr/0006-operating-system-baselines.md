# ADR 0006 — Baselines de sistema operacional

**Status:** aceito  
**Data:** 2026-09-03

## Problema

Suportar a RX 9060 XT agora e a RTX 5070 Ti depois sem reescrever o produto.

## Alternativas

Windows 11, Windows + WSL2, Ubuntu 24.04 nativo, dual boot e Windows 10.

## Decisão

Windows 11 é o baseline diário; Ubuntu 24.04 LTS nativo é o baseline de treino/performance; WSL2 Ubuntu 24.04 é opcional. Windows 10 não é baseline porque não consta na matriz Radeon/ROCm oficial consultada.

## Consequências

Boa experiência desktop e caminho oficial para as duas GPUs, ao custo de manter presets de ambiente. Benchmark pesado pode exigir Linux nativo.
