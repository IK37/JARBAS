# PROJECT DISCOVERY MEETING #001

**Projeto:** JARBAS — Personal R&D OS / plataforma cognitiva pessoal

**Data:** 2026-09-02

**Status:** concluída, com perguntas bloqueadoras

**Regra desta etapa:** nenhuma funcionalidade de produto foi implementada.

**Perspectivas representadas:** arquitetura de software, backend, AI/ML, dados, segurança e privacidade, DevOps/MLOps, performance, produto/UX, QA e revisão crítica.

Não houve votação por popularidade. A síntese preserva as discordâncias relevantes: o time de produto pressionou por uma entrega estreita; dados e segurança exigiram proveniência, exclusão verificável e uma única fonte canônica; AI/ML rejeitou escolher modelo sem medição; arquitetura rejeitou microserviços e frameworks multiagente prematuros; o revisor crítico questionou cada componente que não melhora uma métrica do produto.

## 1. Veredicto executivo

O Prompt Mestre descreve uma visão coerente para vários anos, mas não é o escopo de um MVP. O JARBAS continuará sendo inicialmente um **Personal R&D OS local-first**, centrado no `Project Object`, com uma plataforma cognitiva evolutiva por baixo.

O primeiro produto precisa provar três capacidades:

1. conversar localmente de forma estável;
2. lembrar corretamente, com origem, correção e esquecimento verificável;
3. permitir retomar e avançar projetos reais sem reconstruir contexto.

Memória, Knowledge Graph, agentes, ferramentas, aprendizagem e fine-tuning continuam na visão, mas entram por gates de maturidade. Voz, visão, controle amplo do computador, Council Mode generalizado e treinamento automático ficam fora das primeiras entregas.

Correções fundamentais ao Prompt Mestre:

- **memória contínua não é treinamento contínuo**;
- **relevância não é verdade**;
- **Knowledge Graph é primeiro um modelo de domínio, não obrigatoriamente um banco especializado**;
- **multiagente só é justificável quando avaliações mostram ganho mensurável**;
- **o risco pertence à ação concreta, não apenas ao nome da ferramenta**;
- **decay reduz prioridade de recuperação; não implementa o direito de esquecer**.

## 2. Interpretação do sistema

O produto terá duas camadas complementares:

| Camada               | Responsabilidade                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Product wedge        | Project Memory, Decision Ledger, Next Best Experiment, Project Pulse, Connection Engine e revisão de projetos          |
| Plataforma cognitiva | Memória pessoal, RAG, Knowledge Graph, model routing, agentes, ferramentas, datasets, avaliação e adaptação de modelos |

O loop principal permanece:

```text
ideia → hipótese → pesquisa → decisão → experimento → resultado → aprendizado
```

A unidade central é o `Project Object`, contendo objetivo, critérios de sucesso, decisões, hipóteses, evidências, experimentos, artefatos, bloqueios, relações e próxima ação.

## 3. Requisitos funcionais

### Foundation

- `FR-001`: conversa local com streaming e histórico de sessão.
- `FR-002`: provider de IA abstrato e substituível.
- `FR-003`: detecção de hardware, drivers e backends disponíveis.
- `FR-004`: configuração centralizada e validada.
- `FR-005`: Context Window Manager com compressão rastreável.
- `FR-006`: logs estruturados sem segredos.
- `FR-007`: fallback explícito quando GPU, runtime ou provider falhar.

### Memory

- `FR-010`: extrair candidatos a memória após uma interação.
- `FR-011`: distinguir fato, preferência, decisão, objetivo, projeto, tarefa, ideia, evento, conhecimento e inferência.
- `FR-012`: armazenar proveniência, confiança, importância, sensibilidade, temporalidade e retenção.
- `FR-013`: recuperar memórias com origem acessível.
- `FR-014`: buscar, confirmar, editar, bloquear, exportar e excluir memórias.
- `FR-015`: responder “por que você sabe disso?”.
- `FR-016`: detectar duplicação, refinamento, contradição e substituição sem destruir histórico.
- `FR-017`: aplicar expiração e decay configuráveis.
- `FR-018`: propagar esquecimento ao banco, FTS, vetores, grafo, caches, resumos e datasets ainda não treinados.
- `FR-019`: impedir mistura entre projetos e classes de privacidade.

### Projects and Knowledge

- `FR-020`: capturar ideia, projeto, objetivo, decisão, tarefa e nota com pouca fricção.
- `FR-021`: ligar `GOAL → MILESTONE → PROJECT → TASK → NEXT ACTION`.
- `FR-022`: manter diário de decisões com alternativas, motivos e revisão.
- `FR-023`: retomar projeto mostrando estado, decisão anterior, bloqueio e próxima ação.
- `FR-030`: representar entidades e relações num property graph lógico.
- `FR-031`: registrar origem, confiança, validade e explicação em toda relação.
- `FR-032`: resolver aliases e entidades duplicadas.
- `FR-033`: descobrir conexões não triviais e explicá-las.

### Agents and Tools

- `FR-040`: roteamento inicial determinístico por capacidade, risco, privacidade e custo.
- `FR-041`: agentes especializados com contratos explícitos e orçamento.
- `FR-042`: Critic Agent para decisões relevantes.
- `FR-043`: Council Mode apenas quando benefício superar latência e custo.
- `FR-050`: Tool Registry com schemas, escopos, riscos, timeout e idempotência.
- `FR-051`: Policy Engine determinístico fora do LLM.
- `FR-052`: fluxo `plan → preview → approve → execute → verify → receipt`.
- `FR-053`: auditoria, cancelamento, compensação e kill switch.

### Learning and Evaluation

- `FR-060`: coletar feedback explícito e sinais implícitos com pesos diferentes.
- `FR-061`: criar candidatos de dataset em quarentena.
- `FR-062`: filtrar PII, segredos, conteúdo sem licença, duplicatas e baixa qualidade.
- `FR-063`: versionar datasets, configurações, modelos, adapters e avaliações.
- `FR-064`: separar rigidamente treino, validação e teste.
- `FR-065`: comparar `stable` versus `candidate` por categoria.
- `FR-066`: promover somente com gates e aprovação humana nas primeiras versões.
- `FR-067`: rollback atômico do conjunto compatível, não apenas dos pesos.

## 4. Requisitos não funcionais

### Segurança e privacidade

- nenhum dado externo sem política explícita aplicável;
- LLMs, agentes e conteúdo recuperado são não confiáveis para autorização;
- Policy Engine opera em modo deny-by-default;
- R4 permanece bloqueado no MVP;
- segredos ficam no keychain do sistema operacional;
- dados pessoais mutáveis não entram nos pesos;
- 100% das memórias exibem proveniência e sensibilidade;
- exclusão precisa alcançar todas as projeções e caches;
- conteúdo integral, chain-of-thought e embeddings não entram em telemetria por padrão.

### Desempenho — metas provisórias

- aplicação inicia em menos de 5 segundos sem carregar o LLM;
- CRUD local p95 inferior a 100 ms;
- retrieval sem geração p95 inferior a 500 ms no corpus de referência;
- abertura de estado de projeto p95 inferior a 1 segundo antes da geração;
- UI nunca bloqueia por inferência, embedding, parsing ou treinamento;
- todo processo pesado respeita orçamento de CPU, RAM, VRAM, disco e tempo.

Esses números são hipóteses. Só se tornam SLOs após medição no hardware real.

### Confiabilidade e manutenção

- contratos versionados em todas as fronteiras;
- validação runtime de saídas de modelos e integrações;
- migrações e restauração testadas;
- mutações multi-etapa usam transação/outbox;
- domínio não depende de UI, provider, runtime ou banco;
- CI exige format, lint, typecheck, testes, segurança e build;
- ADR obrigatório para decisões estruturais;
- profiling precede otimizações.

## 5. Inventário de hardware disponível

O inventário exato foi deliberadamente omitido deste repositório público. A Fase 0 deve coletá-lo no próprio equipamento e persistir o resultado em `configs/hardware.local.yaml`, ignorado pelo Git.

Campos obrigatórios:

| Categoria       | Campos                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| Sistema         | edição/versão do OS, kernel/build e arquitetura                         |
| CPU             | modelo, núcleos/threads, ISA e recursos relevantes                      |
| Memória         | RAM total, disponível e limite autorizado ao JARBAS                     |
| GPU             | fabricante, modelo, device ID, VRAM e arquitetura reportada pelo driver |
| Backends        | CUDA, ROCm/HIP, DirectML, Vulkan e versões detectadas                   |
| Disco           | espaço livre, filesystem e orçamento para modelos/datasets              |
| Energia/térmica | limites observáveis quando disponíveis                                  |

Nenhuma classificação `LOW/MEDIUM/HIGH/EXTREME`, seleção de modelo ou afirmação de compatibilidade foi aprovada. O detector deve produzir uma recomendação explicável depois de comparar o inventário local com as matrizes oficiais, incluindo [ROCm](https://rocm.docs.amd.com/en/latest/compatibility/compatibility-matrix.html) e os requisitos [Radeon](https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/docs/prerequisites/prerequisitesrad.html).

## 6. Possíveis stacks

| Alternativa                               | Vantagens                                               | Crítica                                               | Posição                                 |
| ----------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------- |
| TypeScript + Tauri/React + SQLite         | tipos ponta a ponta, UI forte, reuso atual, bom desktop | sidecars e empacotamento exigem disciplina            | stack-base provisória                   |
| Python + FastAPI + desktop webview/PySide | melhor ecossistema ML e prototipagem                    | distribuição desktop e contratos ponta a ponta piores | workers ML, não núcleo                  |
| Rust + Tauri + SQLite                     | footprint, performance e segurança                      | reescrita e velocidade menor                          | capabilities nativas e hotspots medidos |

Decisão: preservar TypeScript strict e pnpm no núcleo; usar Python em processos de ML, parsing, datasets e treinamento; usar Rust apenas quando a capacidade nativa ou profiling justificar.

## 7. Arquitetura inicial

```text
Desktop / CLI / futura Web UI
              │
              ▼
      Local Application Boundary
              │
              ▼
       Application Orchestrator
      ┌───────┼──────────────┐
      ▼       ▼              ▼
 Project   Context       Capability
  Core     Builder         Runtime
      │       │              │
      │       ├─ Memory      ├─ Tool Registry
      │       ├─ Retrieval   ├─ Policy Engine
      │       ├─ Knowledge   ├─ Sandbox
      │       └─ Router      └─ Receipts
      │               │
      ▼               ▼
Canonical Store    LLM Providers
 SQLite + files    local / external
      │
      ├─ FTS projection
      ├─ Vector projection
      ├─ Graph projection
      ├─ Outbox/jobs
      └─ Audit metadata

Processos isolados:
Inference | Document Parsing | Tool Execution | Training/Evaluation
```

Monólito modular não significa um único processo. Processos isolados reduzem impacto de crashes, arquivos hostis, execução de ferramentas e consumo de GPU sem introduzir microserviços distribuídos.

## 8. LLMs candidatos — sem seleção final

Memória indicada abaixo é estimativa operacional. Contexto longo e KV cache podem elevar substancialmente o uso.

| Candidato             | Escala | Papel a testar                | Observação                           |
| --------------------- | -----: | ----------------------------- | ------------------------------------ |
| Phi-4-mini-instruct   |   3.8B | rápido, classificação, router | MIT, function calling                |
| Qwen3-8B              |     8B | primary geral                 | Apache 2.0, multilingual/tools       |
| Ministral 3 8B        |    ~9B | primary/agentic               | Apache 2.0, visão/JSON/tools         |
| Gemma 4 12B           |    12B | primary multimodal            | Apache 2.0, pressão maior de memória |
| Qwen3-14B             |    14B | reasoning                     | limite alto confortável da GPU       |
| Qwen3-VL 4B/8B        | 4B/~9B | visão/OCR                     | medir grounding e VRAM               |
| Phi-4 multimodal      |   5.6B | áudio/visão                   | MIT; AMD precisa ser provada         |
| Mistral Small 3.2 24B |    24B | stress/reference              | offload, não default                 |
| Qwen3.8-27B           |    28B | stress/reference              | não cabe com contexto útil em 16 GB  |

Modelos MoE grandes não devem ser julgados só por parâmetros ativos: todos os pesos precisam ser armazenados. Modelos como Llama 4 Scout e Qwen3-Coder-Next entram apenas como referências até o inventário e o benchmark local provarem viabilidade operacional.

Fontes preliminares: [Qwen3](https://huggingface.co/Qwen/Qwen3-8B), [Ministral 3 8B](https://huggingface.co/mistralai/Ministral-3-8B-Instruct-2512), [Gemma 4](https://ai.google.dev/gemma/docs/core/model_card_4), [Phi-4](https://huggingface.co/microsoft/Phi-4-mini-instruct).

## 9. Runtimes candidatos

| Runtime               | Windows/AMD                         | Linux/ROCm                 | Decisão da Discovery                            |
| --------------------- | ----------------------------------- | -------------------------- | ----------------------------------------------- |
| llama.cpp             | HIP/Vulkan                          | HIP/Vulkan                 | baseline portátil obrigatório                   |
| Ollama                | nativo; Vulkan; ROCm depende da GPU | sim                        | comparar pela simplicidade operacional          |
| vLLM                  | não nativo; WSL                     | forte                      | candidato a servidor Linux, não default Windows |
| Transformers/PyTorch  | limitado para treino no Windows     | forte para pesquisa/treino | ambiente de ML isolado                          |
| ONNX Runtime/DirectML | sim                                 | sim                        | benchmark secundário por modelo                 |

O `llama.cpp` suporta GGUF, quantizações, HIP, Vulkan e CPU+GPU híbrido: [documentação oficial](https://github.com/ggml-org/llama.cpp). Ollama executa nativamente no Windows e oferece Vulkan, mas suporte ROCm varia por GPU; nenhum caminho pode ser presumido antes da detecção local: [Windows](https://docs.ollama.com/windows) e [GPU](https://docs.ollama.com/gpu). vLLM não suporta Windows nativamente: [GPU installation](https://docs.vllm.ai/en/stable/getting_started/installation/gpu/).

Hipótese de benchmark:

- Windows: llama.cpp/Vulkan versus Ollama/Vulkan ou ROCm;
- Linux: llama.cpp/HIP versus vLLM/ROCm;
- treinamento: Ubuntu + PyTorch ROCm, não Windows, até prova contrária.

## 10. Banco, vector store e Knowledge Graph

### System of Record

SQLite com WAL é a escolha aprovada para as fases pessoais e single-device. PostgreSQL entra quando houver múltiplos usuários/dispositivos, serviço remoto, contenção real ou necessidade comprovada de extensões de servidor.

### Vector store

Ainda não escolhido. A porta `VectorIndex` deverá permitir comparar:

1. busca exata;
2. extensão vetorial SQLite madura no momento da implementação;
3. LanceDB embedded;
4. Qdrant local;
5. pgvector apenas se PostgreSQL já for necessário.

FTS5 será o baseline lexical. Qdrant suporta filtros e busca híbrida; LanceDB oferece modo embedded e hybrid search; pgvector possui HNSW/IVFFlat. Fontes: [SQLite FTS5](https://www.sqlite.org/fts5.html), [Qdrant](https://qdrant.tech/documentation/), [LanceDB](https://docs.lancedb.com/), [pgvector](https://github.com/pgvector/pgvector).

### Knowledge Graph

Começar com `knowledge_nodes` e `knowledge_edges` no SQLite. Toda aresta deve registrar proveniência, confiança, validade, status e explicação.

- Neo4j é candidato futuro para traversals e algoritmos comprovadamente complexos.
- Apache AGE faz sentido apenas num futuro PostgreSQL.
- Kuzu foi arquivado e está rejeitado como nova fundação.

## 11. Arquitetura de memória

Separar:

- working memory;
- episodic memory;
- semantic memory;
- prospective memory;
- project state;
- knowledge graph;
- índices derivados.

Uma memória deve ser uma assertion temporal versionada, não apenas texto:

```text
subject + predicate + value
source + source span
explicitness + confidence + importance
sensitivity + retention policy
valid_from + valid_to
candidate/confirmed/disputed/superseded/deleted
```

Não colapsar `confidence`, `importance`, `retrieval relevance`, `retention` e `sensitivity` em um único `memory_score`. Eles respondem a perguntas diferentes.

Fluxo:

```text
evento → classificação → extração → entity resolution → deduplicação
→ conflito → privacy/retention policy → assertion candidata
→ confirmação quando necessária → persistência → projeções derivadas
```

## 12. RAG e embeddings

Pipeline recomendado:

```text
query → intenção/tempo/projeto/ACL → exact search → FTS/BM25
→ dense retrieval → relational filters → graph neighborhood
→ fusion → deduplicação → reranking opcional → context budget
→ resposta com proveniência
```

Candidatos de embedding:

- Qwen3-Embedding-0.6B;
- BGE-M3;
- multilingual-e5-large como controle.

Devem ser comparados num corpus real em português e inglês. MTEB global não escolhe o vencedor do JARBAS. Fontes: [Qwen3 Embedding](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B), [BGE-M3](https://huggingface.co/BAAI/bge-m3) e [multilingual E5](https://huggingface.co/intfloat/multilingual-e5-large).

## 13. Fine-tuning e aprendizado

Ordem aprovada:

1. personality/configuration layer;
2. memória estruturada e RAG;
3. SFT com LoRA;
4. QLoRA se o backend AMD for estável;
5. DPO somente após pares explícitos de preferência suficientes;
6. distillation somente após análise de licença e proveniência;
7. full fine-tuning e RL avançado ficam fora do MVP.

LoRA mantém o modelo-base congelado e reduz parâmetros treináveis: [Hugging Face PEFT](https://huggingface.co/docs/peft/main/conceptual_guides/lora). DPO exige pares `chosen/rejected`: [TRL DPO](https://huggingface.co/docs/trl/dpo_trainer).

Treinamento automático nunca significa implantação automática. O candidato passa por elegibilidade, privacidade, qualidade, isolamento do test set, execução reproduzível, scan do artefato, avaliação funcional, segurança, performance, canário e aprovação.

## 14. Riscos prioritários

| Risco                             | Probabilidade | Impacto    | Mitigação                                   |
| --------------------------------- | ------------- | ---------- | ------------------------------------------- |
| Explosão das 112 seções           | muito alta    | crítico    | gates e versões pequenas                    |
| Memória falsa/poisoning           | alta          | crítico    | proveniência, status e confirmação          |
| Multiagente teatral               | alta          | alto       | benchmark contra single-agent               |
| Estado divergente SQL/vetor/grafo | alta          | alto       | fonte canônica + projeções rebuildáveis     |
| Prompt injection/excessive agency | alta          | crítico    | Policy Engine e sandbox                     |
| Exclusão incompleta               | alta          | crítico    | deletion ledger e testes E2E                |
| Fine-tuning memorizar PII         | média         | crítico    | fatos pessoais fora dos pesos               |
| GPU de consumo + Windows incerto  | média/alta    | alto       | múltiplos backends e benchmark real         |
| Três linguagens sem limites       | média         | alto       | TypeScript default, boundaries justificadas |
| Logs virarem banco íntimo         | alta          | alto       | metadata-first e retenção                   |
| Supply chain de modelos           | média         | crítico    | hashes, safetensors, allowlist e sandbox    |
| Confirmation fatigue              | alta          | médio/alto | confirmação contextual e rara               |

### Threats de segurança prioritárias

- prompt injection direta e indireta em páginas, documentos, e-mails e resultados de RAG;
- excessive agency, confused deputy e escalada de permissão por composição de ferramentas;
- exfiltração por provider externo, logs, embeddings, telemetria ou mensagens de erro;
- memory/KG poisoning, contradição mal resolvida e vazamento entre projetos;
- dataset poisoning, contaminação do test set e memorização de PII no fine-tuning;
- path traversal, symlink/TOCTOU, escape de sandbox e execução de artefatos de modelo não confiáveis;
- comprometimento da supply chain de pacotes, modelos, GitHub Actions e atualizações;
- denial of wallet/compute por loops de agentes, contexto sem limite ou treinamento não orçado.

Controles estruturais: trust boundaries explícitas, Policy Engine deny-by-default, schemas estritos, capabilities mínimas e temporárias, isolamento de processos, egress control, hashes/allowlists, trilhas de auditoria segregadas e testes adversariais obrigatórios.

## 15. Plano de testes

### Unitários

Scoring e decay, classificação, deduplicação, contradições, roteamento, políticas, filtros de privacidade, context budgeting e schemas.

### Integração

Provider↔router, conversa↔memória, memória↔retrieval, memória↔grafo, agente↔ferramenta, exclusão↔todas as projeções e dataset↔privacy filter.

### E2E críticos

1. preferência informada reaparece corretamente em nova sessão;
2. preferência atualizada substitui a visão atual preservando histórico;
3. pedido de esquecer elimina banco, índices, caches e respostas futuras;
4. inferência nunca vira fato sem status explícito;
5. projetos semelhantes não vazam contexto entre si;
6. documento malicioso não concede instruções ao agente;
7. ferramenta sensível é bloqueada sem autorização contextual;
8. provider externo indisponível aciona fallback permitido;
9. modelo candidato pior não é promovido;
10. rollback restaura o conjunto estável compatível.

## 16. Plano de benchmarks

### Modelos e runtimes

- mesmo modelo/quantização em todos os runtimes comparáveis;
- contextos 1K, 8K e 32K;
- respostas 128, 512 e 2.048 tokens;
- warm-up separado, três repetições e seeds registradas;
- TTFT, prompt tokens/s, decode tokens/s, p50/p95, RAM, VRAM, temperatura, consumo e estabilidade;
- tool calling, structured output, português, código, memória, crítica e prompt injection.

Suite inicial prevista: aproximadamente 210 casos, incluindo 40 prompts em português, 30 tool calls, 20 structured outputs e categorias críticas separadas.

### Retrieval

Corpus real bilíngue, pelo menos 300 queries julgadas, Recall@1/5/10, MRR@10, nDCG@10, context precision/recall, vazamento entre escopos, latência e tamanho do índice.

Comparar BM25, dense, RRF, RRF+recência/importância, reranker e graph expansion.

### Dados e grafo

10k, 100k e 1M records/edges; cold/warm; crash recovery; backup/restore; migração; exclusão; rebuild; traversals de 1–4 saltos.

## 17. Roadmap técnico revisado

| Versão/Fase                | Entrega                                                | Gate                              |
| -------------------------- | ------------------------------------------------------ | --------------------------------- |
| Fase 0                     | discovery, hardware, benchmark e ADRs                  | decisões reproduzíveis            |
| v0.1 Foundation            | provider, conversa local, config, logs, CI             | chat local estável                |
| v0.2 Trusted Memory        | assertions, retrieval, contradição, auditoria e forget | memória controlável entre sessões |
| v0.3 Project Intelligence  | projetos, objetivos, decisões e retomada               | 3–5 projetos sem mistura          |
| v0.4 Agents & Safe Tools   | router, poucos agentes, registry e policy              | routing/tool use mensurável       |
| v0.5 Learning Data         | feedback, privacy filter, datasets e benchmark         | dados confiáveis e segregados     |
| v0.6 Manual Fine-tuning    | LoRA/QLoRA candidato, avaliação e rollback             | ganho sem regressão crítica       |
| v0.7 Controlled Automation | scheduler de treino sem autopromoção                   | operação reproduzível e segura    |
| Posterior                  | Opportunity Engine, voz, visão e polish                | somente após retenção comprovada  |

## 18. Perguntas bloqueadoras

### Hardware e operação

1. Qual sistema operacional e versão serão o baseline de suporte?
2. Você aceita dual boot ou um segundo SSD com Ubuntu para benchmarks/treinamento ROCm?
3. Quanto espaço livre existe no NVMe?
4. A IA pode usar a GPU enquanto FL Studio, jogos ou renders estão abertos?
5. Você aceitaria ampliar a RAM para 64 GB no futuro?

### Produto

6. O MVP será exclusivamente pessoal/single-user?
7. Quais 3–5 projetos reais validarão a retomada em 30 segundos?
8. A primeira interface utilizável deve ser CLI, desktop ou web local?
9. Português brasileiro tem prioridade sobre inglês e programação?
10. O projeto deve permitir uso comercial desde a primeira escolha de licença/modelo?

### Privacidade e dados

11. Quais classes de dado nunca podem sair do computador?
12. Você prefere chave no Windows, senha própria ou ambos para criptografia?
13. “Esquecer” deve apagar imediatamente ou passar por lixeira recuperável?
14. Conversas brutas devem ser armazenadas ou somente memórias extraídas?
15. Fine-tuning com dados pessoais exige aprovação por amostra, lote ou será proibido?
16. Telemetria deve ser local, remota opt-in ou inexistente?

### Performance e modelos

17. Qual TTFT é aceitável no modo normal: 0,5 s, 1 s, 2 s ou 5 s?
18. Qual contexto real é necessário: 8K, 16K, 32K ou superior?
19. Modelos podem ser baixados automaticamente após confirmação?
20. Quanto de disco pode ser reservado para pesos, adapters, datasets e versões antigas?

### Ferramentas e autonomia

21. Quais três ferramentas gerariam valor primeiro?
22. Quais ações devem permanecer proibidas mesmo com confirmação?
23. O modo offline estrito deve bloquear tecnicamente toda saída de rede?
24. A primeira versão deve apenas preparar ações ou executar ações reversíveis confirmadas?

## 19. Decisões formais

### Aprovadas

- monólito modular local-first;
- `Project Object` como núcleo do produto;
- LLM sem autoridade e Policy Engine determinístico;
- SQLite como System of Record inicial;
- FTS, vetor e grafo como projeções derivadas e reconstruíveis;
- provider/runtime/modelo substituíveis;
- TypeScript no núcleo, Python/Rust em boundaries justificados;
- processos isolados para inferência, parsing, ferramentas e treinamento;
- fatos pessoais mutáveis fora dos pesos;
- promoção humana e rollback para modelos candidatos;
- Kuzu rejeitado por arquivamento do projeto.

### Provisórias, exigem benchmark

- llama.cpp/Vulkan ou Ollama no Windows;
- vLLM/ROCm no Linux;
- Qwen3-8B, Ministral 3 8B e Gemma 4 12B como candidatos primary;
- Phi-4-mini como fast;
- Qwen3-Embedding, BGE-M3 e multilingual-e5 como embeddings;
- busca exata, LanceDB e Qdrant como vector candidates.

### Rejeitadas nesta fase

- microserviços, Kubernetes e service mesh;
- Neo4j obrigatório;
- framework multiagente obrigatório;
- captura contínua de tela, câmera ou microfone;
- shell irrestrito;
- fine-tuning e promoção automáticos;
- implementação simultânea das 112 seções;
- escolha de modelo por benchmark público ou número de parâmetros.

## 20. Próxima reunião

`MODEL & AI STACK REVIEW #001`, após confirmar hardware/SO e critérios bloqueadores. Essa reunião executará a matriz de benchmarks e produzirá ADR de runtime/modelo somente quando houver medições reproduzíveis.
