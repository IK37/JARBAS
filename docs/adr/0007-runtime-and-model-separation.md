# ADR 0007 — Separar modelo lógico do runtime

**Status:** aceito  
**Data:** 2026-09-03

## Problema

O mesmo modelo deve rodar via ROCm, Vulkan, CUDA ou CPU sem contaminar domínio/aplicação.

## Alternativas

Acoplamento direto ao Ollama; SDK de framework; contrato próprio orientado a capabilities.

## Decisão

`ModelDefinition` registra identidade e artefatos por runtime. `RuntimeDefinition` descreve endpoint/backend/capabilities. `LlmProvider` oferece streaming e saúde; `ModelRouter` resolve ambos por configuração.

## Consequências

Migração AMD → NVIDIA fica na infraestrutura. Recursos exclusivos podem exigir extensões, mas não invadem o core.
