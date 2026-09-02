# ADR 0004 — Modelos e runtimes selecionados por avaliação

**Status:** aceito

**Data:** 2026-09-02

## Problema

Modelos e runtimes evoluem rapidamente e apresentam comportamento diferente conforme hardware, quantização, contexto, idioma e tool calling. Acoplar o produto a uma opção atual criaria lock-in e impediria comparação justa.

## Requisitos

- operação local no hardware real do usuário;
- português, structured output, tool calling e código mensuráveis;
- fallback entre capacidades e providers;
- rastreabilidade de modelo, runtime, quantização e configuração;
- licenças compatíveis com o uso planejado;
- atualização sem reescrever o domínio.

## Alternativas

1. Escolher um modelo/runtime fixo por popularidade.
2. Adotar apenas um serviço externo.
3. Definir providers neutros e promover configurações por benchmark reproduzível.

## Comparação

| Opção                 | Time-to-first-run | Lock-in    | Otimização local  | Auditabilidade       |
| --------------------- | ----------------- | ---------- | ----------------- | -------------------- |
| Modelo/runtime fixo   | alto              | alto       | inicialmente alta | média                |
| Serviço externo único | alto              | muito alto | baixa             | dependente do vendor |
| Providers + avaliação | médio             | baixo      | alta              | alta                 |

## Argumentos contrários

- Uma abstração ampla demais pode nivelar capacidades avançadas por baixo.
- Manter adapters e suítes de benchmark tem custo contínuo.
- Resultados podem variar após atualização de driver ou runtime.

Por isso o contrato será orientado por capabilities, permitirá extensões específicas isoladas e versionará o ambiente completo avaliado.

## Decisão

O JARBAS dependerá de contratos de provider e capabilities, não de um modelo ou runtime específico. `MODEL_PRIMARY`, `MODEL_FAST`, `MODEL_REASONING`, `MODEL_CODING`, `MODEL_EMBEDDING` e `MODEL_OPTIONAL_VISION` serão aliases para artefatos avaliados.

Nenhum modelo foi escolhido nesta ADR. A escolha exige medições no hardware real.

## Motivo

Qualidade pública e número de parâmetros não predizem a melhor combinação no computador, idioma e tarefas do JARBAS. Benchmark local transforma a escolha em decisão reproduzível.

## Critérios mínimos

- qualidade em português, projetos, memória, código e segurança;
- structured output e tool calling;
- TTFT, tokens/s, RAM, VRAM, estabilidade e consumo;
- licença e proveniência;
- funcionamento offline e compatibilidade do backend;
- ausência de regressão crítica.

## Consequências

- troca de modelo não reescreve o domínio;
- quantização e runtime fazem parte da versão avaliada;
- resultados públicos formam candidatos, mas não decidem;
- haverá custo inicial para criar a suíte de avaliação.
