# ADR 0002 — LLM sem autoridade

**Status:** aceito

**Data:** 2026-09-02

## Decisão

Tratar saídas do LLM e conteúdo recuperado como dados não confiáveis. O modelo pode propor planos e chamadas estruturadas, mas um Policy Engine determinístico decide se uma ação pode prosseguir.

## Consequências

- Permissões não vivem apenas em prompts.
- Ações externas ou irreversíveis exigem confirmação contextual.
- Cada execução produz recibo auditável.
- Falhas devem bloquear com segurança.
