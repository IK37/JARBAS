# Development

## Requisitos

- Node.js 24 LTS;
- Corepack e pnpm 10.15;
- Ollama ou outro endpoint OpenAI-compatible para inferência real.

## Setup

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm test:coverage
corepack pnpm security:scan
corepack pnpm smoke
```

Para iniciar o provider mock em Bash/Zsh:

```bash
JARBAS_PROVIDER=mock-local corepack pnpm start
```

Em PowerShell:

```powershell
$env:JARBAS_PROVIDER = "mock-local"
corepack pnpm start
```

Use `corepack pnpm` para respeitar a versão exata declarada em `packageManager`. A configuração do workspace rejeita outra versão, autoriza somente o lifecycle script revisado do `esbuild` e falha se uma nova dependência tentar executar script sem aprovação explícita.

Um `node_modules` criado antes dessa política pode registrar o `esbuild` como ignorado. Nesse caso, execute uma vez `corepack pnpm rebuild esbuild` e repita o frozen install. Não use aprovação global de scripts.

O provider mock existe apenas para desenvolvimento/CI. O padrão é `ollama-local` e falha explicitamente quando o runtime/modelo não está disponível. Não existe fallback automático implementado nesta fase.

## Configuração

Arquivos versionados ficam em `configs/`. Secrets entram apenas por variáveis de ambiente. A V1 recusa bind fora de loopback, valida estruturalmente todos os arquivos de configuração e não permite habilitar conteúdo nos logs. Limites de body, mensagem, saída, janela de contexto e evento SSE são configuráveis.

## Gates locais

`pnpm check` valida as dependências workspace do harness runtime e executa formatação, lint, tipagem, testes unitários, build oficial e testes de integração. `pnpm test:runtime` faz seu próprio build e não depende de `dist/` residual. `pnpm security:scan` audita dependências e arquivos rastreados. `pnpm smoke` inicia o artefato compilado em um processo separado.

## Reproducibility Gate

Antes de release, os gates acima devem passar em checkout sem `node_modules`, `dist` ou links manuais anteriores, usando frozen lockfile. O CI repete `check`, coverage, security scan e smoke em runners novos Ubuntu e Windows. Resultado obtido apenas em ambiente incremental não é evidência suficiente de release.
