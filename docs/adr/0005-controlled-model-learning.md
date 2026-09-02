# ADR 0005 — Aprendizado de modelo controlado

**Status:** aceito

**Data:** 2026-09-02

## Problema

Treinar automaticamente em interações brutas pode reforçar alucinações, memorizar dados pessoais, contaminar avaliações e degradar capacidades.

## Requisitos

- adaptar estilo e capacidades sem transformar fatos pessoais mutáveis em pesos;
- consentimento, proveniência, finalidade e exclusão auditáveis;
- datasets e splits reproduzíveis;
- comparação objetiva entre stable e candidate;
- rollback do modelo, adapter, prompts, tools e índices compatíveis.

## Alternativas

1. Treinar continuamente em todas as conversas.
2. Não realizar fine-tuning e depender apenas de prompts/RAG.
3. Separar memória contínua de ciclos controlados de aprendizado de modelo.

## Comparação

| Opção                 | Adaptação      | Privacidade | Risco de regressão | Reversibilidade |
| --------------------- | -------------- | ----------- | ------------------ | --------------- |
| Treino contínuo bruto | alta aparente  | baixa       | muito alto         | baixa           |
| Apenas prompt/RAG     | média          | alta        | baixo              | alta            |
| Ciclos controlados    | alta e gradual | alta        | controlado         | alta            |

## Argumentos contrários

- O pipeline controlado aprende mais devagar e custa engenharia/MLOps.
- Aprovação humana inicial reduz automação.
- Alguns ganhos podem ser obtidos com memória e prompts, tornando o treino desnecessário.

O terceiro ponto é intencional: fine-tuning só deve existir quando a avaliação mostrar um déficit persistente que memória, RAG e configuração não resolvem.

## Decisão

Separar memória contínua de aprendizado dos pesos. Fatos, projetos, objetivos e preferências mutáveis permanecem em memória estruturada/RAG.

Fine-tuning ocorrerá somente em ciclos versionados:

```text
candidate extraction → quarantine → privacy → quality → approval
→ dataset version → training → candidate → evaluation → approval → promotion
```

Treinamento automático futuro poderá gerar `MODEL_CANDIDATE`, nunca promover diretamente a `MODEL_STABLE`.

## Motivo

Memória e pesos têm semânticas, riscos e ciclos de vida diferentes. Separá-los preserva o direito de corrigir/esquecer e torna regressões detectáveis.

## Gates obrigatórios

- origem, consentimento e finalidade;
- PII, secrets, licença e deduplicação;
- isolamento train/validation/test;
- configuração e artefatos reproduzíveis;
- avaliação funcional, adversarial e operacional;
- zero regressão crítica em privacidade e permissões;
- aprovação humana nas primeiras gerações;
- rollback do conjunto compatível.

## Consequências

- adaptação de pesos ocorrerá mais tarde que memória/RAG;
- datasets e models terão registros próprios;
- saídas do próprio modelo não viram ground truth automaticamente;
- remoção de memória pessoal continua tecnicamente possível.
