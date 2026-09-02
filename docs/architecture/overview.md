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

## Stack pretendida

- TypeScript strict em monorepo pnpm.
- Tauri 2 + React para desktop.
- Fastify para API local.
- Rust somente para capacidades nativas.
- SQLite local; PostgreSQL + pgvector quando sync/servidor forem necessários.
- Python somente para áudio, visão ou ML que realmente exijam seu ecossistema.
- OpenTelemetry com redação de dados sensíveis.
