# ADR 0008 — Interface da Foundation V1

**Status:** aceito  
**Data:** 2026-09-03

## Problema

Entregar chat local rápido sem colocar lógica cognitiva na interface nem criar toolchain desktop prematuro.

## Alternativas

CLI, React + API, Tauri e web estática + API nativa Node.

## Decisão

Web estática local servida por API Node vinculada ao loopback. CLI será diagnóstica. React/Tauri serão reavaliados quando o estado de UI justificar framework/empacotamento.

## Consequências

Zero dependência de frontend, streaming/cancelamento reais e fronteira API preservada. A V1 não oferece distribuição desktop nem estado sofisticado.
