# Development

## Requisitos

- Node.js 24 LTS;
- Corepack e pnpm 10.15;
- Ollama ou outro endpoint OpenAI-compatible para inferência real.

## Setup

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm security:scan
pnpm smoke
JARBAS_PROVIDER=mock-local pnpm start
```

O provider mock existe apenas para desenvolvimento/CI. O padrão é `ollama-local` e falha explicitamente quando o runtime/modelo não está disponível. Não existe fallback automático implementado nesta fase.

## Configuração

Arquivos versionados ficam em `configs/`. Secrets entram apenas por variáveis de ambiente. A V1 recusa bind fora de loopback, valida estruturalmente todos os arquivos de configuração e não permite habilitar conteúdo nos logs. Limites de body, mensagem, saída, janela de contexto e evento SSE são configuráveis.

## Gates locais

`pnpm check` executa formatação, lint, tipagem, testes unitários, build oficial e testes de integração. `pnpm security:scan` audita dependências e arquivos rastreados. `pnpm smoke` inicia o artefato compilado em um processo separado.
