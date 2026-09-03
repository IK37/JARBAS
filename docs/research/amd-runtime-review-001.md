# REAL AMD RUNTIME & MODEL REVIEW #001

**Status:** runtime e aceleração de GPU comprovados; benchmark de desempenho e aceitação funcional ainda em progresso

**Data:** 2026-09-03

**Hardware-alvo:** Ryzen 5 9600X, Radeon RX 9060 XT 16 GB, 32 GB RAM

## Resultado executivo

O primeiro teste real eliminou a principal incerteza de compatibilidade: Ollama 0.33.2
executou `qwen3.5:4b` na Radeon RX 9060 XT por ROCm. O runtime descartou a GPU integrada,
identificou a GPU discreta como `gfx1200`, informou 15,9 GiB de VRAM e carregou o modelo
integralmente em `ROCm0`. `ollama ps` confirmou `100% GPU` com contexto 4096.

Isso comprova o caminho de inferência real, mas ainda não aceita o Milestone 1. TTFT,
tokens/s, variação entre execuções, qualidade, streaming do JARBAS, cancelamento,
disconnect, timeout e persistência com o provider real ainda precisam ser medidos.

## Evidência observada

| Item                    | Resultado                                          | Estado                  |
| ----------------------- | -------------------------------------------------- | ----------------------- |
| Sistema operacional     | Windows 10, build 19045                            | OBSERVED                |
| CPU                     | AMD Ryzen 5 9600X, 12 processadores lógicos        | OBSERVED                |
| RAM                     | 31,11 GB                                           | OBSERVED                |
| GPU discreta            | AMD Radeon RX 9060 XT                              | OBSERVED                |
| Driver                  | 32.0.21030.31                                      | OBSERVED                |
| Runtime                 | Ollama 0.33.2                                      | OBSERVED                |
| Modelo inicial          | `qwen3.5:4b`, download de 3,4 GB                   | OBSERVED                |
| Backend efetivo         | ROCm, biblioteca `rocm_v7_1`, alvo `gfx1200`       | PASS                    |
| VRAM do runtime         | 15,9 GiB total, 15,8 GiB disponível antes da carga | OBSERVED                |
| Offload                 | `100% GPU`; modelo carregado em `ROCm0`            | PASS                    |
| Contexto carregado      | 4096                                               | OBSERVED                |
| Resposta mínima         | retornou `JARBAS_OK` corretamente                  | PASS                    |
| Desempenho reproduzível | ainda não executado pelo harness versionado        | NOT BENCHMARKED LOCALLY |

O valor de aproximadamente 4 GB anteriormente exibido por `Win32_VideoController.AdapterRAM`
não representa a VRAM real. Esse campo WMI é limitado para placas com mais de 4 GiB. O detector
foi corrigido para marcar esse valor como não confiável e para não confundir a ausência do
comando de sistema `rocminfo` com ausência de ROCm empacotado pelo runtime.

## Comportamento do modelo inicial

`qwen3.5:4b` obedeceu ao resultado final pedido, mas exibiu um processo de thinking longo para
uma solicitação trivial. Isso prejudica o perfil FAST. O benchmark passa a enviar
`reasoning_effort: "none"` explicitamente; outros níveis só serão avaliados em perfis que
justifiquem raciocínio adicional.

## Decisão provisória de runtime

| Papel         | Candidato            | Estado                  | Justificativa                                                                       |
| ------------- | -------------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| Primary AMD   | Ollama 0.33.2 + ROCm | PROVISIONAL             | funcionamento real comprovado na GPU-alvo e boundary OpenAI-compatible já existente |
| Optional AMD  | llama.cpp Vulkan/HIP | NOT TESTED              | permanece controle comparativo; instalar apenas depois do baseline Ollama           |
| Model FAST    | Qwen3.5 4B           | IN PROGRESS             | execução real comprovada; qualidade e desempenho ainda não medidos                  |
| Model PRIMARY | Qwen3.5 9B           | NOT BENCHMARKED LOCALLY | próximo candidato balanceado                                                        |
| Challenger    | Ministral 3 8B       | NOT BENCHMARKED LOCALLY | controle de qualidade/structured output                                             |

O runtime ainda não é promovido a seleção final. A decisão definitiva exige benchmark e os
testes de lifecycle do JARBAS.

## Harness de benchmark

O harness usa o `OpenAiCompatibleProvider` de produção em vez de manter um segundo parser SSE.
Ele executa aquecimento e múltiplas medições serialmente, valida health/modelo, exige terminal
semântico e resposta visível, limita tamanho/eventos, mede TTFT e throughput end-to-end,
consulta `/api/ps`, exige por padrão pelo menos 95% de offload em VRAM e grava relatório
versionável por hash da suíte. O harness não publica uma taxa de decode estimada a partir do
primeiro token visível, pois reasoning oculto poderia tornar essa métrica enganosa.

A residência em VRAM vem da API do Ollama. Nome da GPU e backend fornecidos por variável de
ambiente são registrados apenas como declaração do operador; não são tratados pelo harness
como prova independente. A evidência externa desta revisão vem do log do runtime.

## Critérios ainda abertos

- executar o harness versionado para `qwen3.5:4b`;
- medir TTFT, throughput, RAM, VRAM, estabilidade e variação;
- testar a suíte funcional em português, JSON, tool selection, código e prompt injection;
- validar streaming pelo JARBAS, cancelamento, disconnect rollback e timeout;
- validar health e persistência SQLite depois de restart;
- comparar `qwen3.5:9b` e `ministral-3:8b`;
- executar controle mínimo com llama.cpp antes da seleção final.

## Triple review do harness

A primeira rodada terminou em `FAIL` nas três perspectivas. Foram encontrados e corrigidos:

- parser SSE duplicado e divergente do provider de produção;
- throughput de decode incorreto para reasoning oculto;
- warm-up, resposta vazia e métricas ausentes capazes de gerar falso-verde;
- aceitação de qualquer quantidade positiva de VRAM;
- endpoint externo rotulado como benchmark local;
- protocolo de aceitação rebaixável para uma run, zero warm-up e 1% de offload;
- eventos de reasoning fora do limite agregado;
- redirects capazes de encaminhar prompts a outro destino;
- IDs de suíte e endpoint sem validação suficiente;
- documentação divergente da evidência real.

Após as correções:

- Review #1 — correção técnica: **PASS**;
- Review #2 — arquitetura e qualidade: **PASS**;
- Review #3 — segurança, regressão e release: **PASS**;
- 8 testes Vitest + 41 testes runtime: **PASS**;
- formatter, lint, TypeScript strict e 11 builds: **PASS**;
- coverage, audit, secret scan, smoke e `git diff --check`: **PASS**.

O PASS autoriza commit e validação remota do harness. Não substitui o benchmark real.

## Fontes primárias

- [Ollama releases](https://github.com/ollama/ollama/releases/latest)
- [Ollama no Windows](https://docs.ollama.com/windows)
- [Ollama GPU support](https://docs.ollama.com/gpu)
- [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)
- [AMD GPU specifications](https://rocm.docs.amd.com/en/latest/reference/gpu-specs.html)
- [AMD ROCm Windows system requirements](https://rocm.docs.amd.com/projects/install-on-windows/en/latest/reference/system-requirements.html)
- [llama.cpp build documentation](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)
- [Qwen3.5 4B model card](https://huggingface.co/Qwen/Qwen3.5-4B)
- [Qwen3.5 9B model card](https://huggingface.co/Qwen/Qwen3.5-9B)
- [Ministral 3 8B model card](https://huggingface.co/mistralai/Ministral-3-8B-Instruct-2512)

## Veredito

```text
REAL AMD RUNTIME
= PASS

REAL MODEL EXECUTION
= PASS

REAL MODEL BENCHMARK
= IN PROGRESS

MILESTONE 1
= NO-GO
```

Blockers restantes: benchmark reproduzível e testes reais do lifecycle do JARBAS.
