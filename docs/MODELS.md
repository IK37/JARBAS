# Models

Todos os modelos em `configs/models.json` são candidatos. O roteador resolve modelo lógico, runtime e artefato separadamente.

| Alias     | Candidato inicial           | Estado                  |
| --------- | --------------------------- | ----------------------- |
| FAST      | Qwen3.5 4B Q4_K_M           | NOT BENCHMARKED LOCALLY |
| PRIMARY   | Qwen3.5 9B Q4_K_M           | NOT BENCHMARKED LOCALLY |
| REASONING | Qwen3.5 9B / Ministral 3 8B | NOT BENCHMARKED LOCALLY |
| CODING    | Qwen3.5 9B                  | NOT BENCHMARKED LOCALLY |
| EMBEDDING | Qwen3 Embedding 0.6B        | NOT BENCHMARKED LOCALLY |

Promoção exige benchmark pessoal, segurança, structured output, tool use e métricas de hardware. Veja `docs/research/model-ai-stack-review-001.md`.
