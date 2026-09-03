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
pnpm build
JARBAS_PROVIDER=mock-local pnpm start
```

O provider mock existe apenas para desenvolvimento/CI. O padrão é `ollama-local` e falha explicitamente quando o runtime/modelo não está disponível.

## Configuração

Arquivos versionados ficam em `configs/`. Secrets entram apenas por variáveis de ambiente. A V1 recusa bind fora de loopback e não permite habilitar conteúdo nos logs.

## Runtime build de contingência

`pnpm build:runtime` usa a transformação TypeScript experimental do Node para validar o runtime sem baixar dependências. Ele não substitui `tsc`, lint ou o build de release.
