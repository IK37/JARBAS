# Project JARVIS — Personal R&D OS

Um sistema operacional pessoal de P&D que transforma ideias dispersas em projetos concluídos, preserva decisões, encontra conexões e recomenda o próximo experimento com evidências.

> Lembrar sem vigiar. Orientar sem mandar. Conectar sem inventar. Melhorar sem explorar.

## O que torna este projeto diferente

O produto não tenta vencer assistentes generalistas em conversa, voz ou quantidade de integrações. Sua unidade central é o **Project Object**: um registro vivo do objetivo, hipóteses, decisões, evidências, experimentos, artefatos, bloqueios e próxima ação de cada projeto.

O loop principal é:

```text
ideia → hipótese → pesquisa → decisão → experimento → resultado → aprendizado
```

## MVP

- Project Memory com origem, confiança e correção.
- Decision Ledger com alternativas e motivos.
- Next Best Experiment para reduzir a maior incerteza.
- Weekly Review e radar de projetos esquecidos.
- Connection Engine com explicações, não apenas similaridade.
- Policy Engine para que ações sejam explícitas, limitadas e auditáveis.

Ficam fora do MVP: captura contínua de tela/microfone, shell arbitrário, compras, envio autônomo de mensagens, exclusão permanente, hardware próprio e avatar cinematográfico.

## Arquitetura

Começamos como um **monólito modular local-first**. O LLM propõe; componentes determinísticos validam e executam.

```text
Interface → Application Core → Intelligence → Policy Engine → Executor → Receipt
                    ↕                 ↕
              Project State      Memory / Evidence
```

Veja [docs/architecture/overview.md](docs/architecture/overview.md), [docs/product/product-brief.md](docs/product/product-brief.md), [docs/security/threat-model.md](docs/security/threat-model.md) e a [Project Discovery Meeting #001](docs/research/discovery-meeting-001.md).

## Estrutura

```text
apps/                 produtos executáveis (desktop/API nas próximas iterações)
packages/contracts/   contratos tipados e estáveis
packages/domain/      regras de projetos, decisões e memória
packages/security/    política determinística de ações
docs/                 produto, arquitetura, ciência, segurança e ADRs
```

## Qualidade

O pedido de revisar o código mais de duas vezes virou três gates verificáveis:

1. Estático: formatação, lint e TypeScript strict.
2. Comportamental: testes de domínio, contratos e integração.
3. Crítico: revisão de segurança, avaliações de IA e revisão humana antes do merge.

```bash
corepack enable
pnpm install
pnpm check
```

## Estado atual

Esta versão funda os contratos do Project Object e do Policy Engine. O roadmap completo está em [docs/product/roadmap.md](docs/product/roadmap.md).
