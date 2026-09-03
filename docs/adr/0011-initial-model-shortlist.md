# ADR 0011 — Shortlist inicial, sem promoção

**Status:** provisório  
**Data:** 2026-09-03

## Problema

Escolher candidatos realistas para 16 GB de VRAM sem inventar desempenho local.

## Decisão

Avaliar Qwen3.5 4B Q4_K_M como FAST; Qwen3.5 9B Q4_K_M como PRIMARY/CODING; Qwen3.5 9B e Ministral 3 8B como REASONING; Qwen3 Embedding 0.6B com EmbeddingGemma/BGE-M3 como controles. Reranker permanece desativado.

## Critério de promoção

Benchmark local reproduzível em português, código, JSON, tools, segurança, TTFT, tokens/s, RAM/VRAM e estabilidade. Até lá: `CANDIDATE / NOT BENCHMARKED LOCALLY`.

## Consequências

Existe baseline para começar a medir, mas nenhuma alegação de vencedor ou velocidade esperada sem dados reais.
