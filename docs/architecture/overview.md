# Arquitetura

## Decisão

Monólito modular local-first. Microserviços só serão extraídos quando carga, isolamento ou estrutura de equipe provarem a necessidade.

## Camadas

1. Interfaces: desktop, companion web, chat, push-to-talk e notificações.
2. Application Core: projetos, objetivos, tarefas, decisões e preferências.
3. Intelligence: recuperação, planejamento, avaliação e roteamento de modelos.
4. Capability Runtime: ferramentas, políticas, sandbox e automações.
5. Memory/Knowledge: estado canônico, eventos, evidências, busca e relações.
6. Infrastructure: SQLite local, arquivos, telemetria, segredos e providers.

## Memória

- **Working:** temporária e vinculada à sessão.
- **Episodic:** acontecimentos com data e origem.
- **Semantic:** fatos consolidados e corrigíveis.
- **Prospective:** itens a retomar no futuro.
- **Project state:** verdade canônica e editável do projeto.

Embeddings recuperam candidatos; nunca são a fonte da verdade. A busca será híbrida: filtros estruturados, texto integral, vetores e reranking.

## Ferramentas

Toda mutação segue:

```text
plan → preview → approve → execute → verify → receipt
```

O modelo nunca acessa diretamente o sistema operacional, banco ou integração. Cada ferramenta declara schema, escopos, risco, efeitos, reversibilidade, timeout e estratégia de compensação.

## Stack da Foundation V1

- TypeScript strict em monorepo pnpm.
- Web estática local e API HTTP nativa Node; React/Tauri serão reavaliados na fase de produto.
- Contrato OpenAI-compatible para Ollama, llama.cpp e runtimes futuros.
- Application Core depende de portas para storage, logging e roteamento; adapters são montados apenas em `apps/api`.
- Context Window Manager determinístico usa o budget do modelo e registra truncamentos sem logar conteúdo.
- Um único turno por sessão é permitido no processo V1; concorrência adicional recebe conflito explícito.
- Rust somente para capacidades nativas.
- SQLite local com migrations; PostgreSQL apenas quando sync/concurrency exigirem.
- Python somente para áudio, visão ou ML que realmente exijam seu ecossistema.
- Logs JSON redigidos agora; OpenTelemetry quando houver exportador/collector real.
