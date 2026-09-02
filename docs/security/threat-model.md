# Threat model do MVP

## Ativos

Memória pessoal, projetos, arquivos autorizados, credenciais de integrações, decisões, evidências e recibos de ações.

## Ameaças prioritárias

| Ameaça                    | Defesa                                                    |
| ------------------------- | --------------------------------------------------------- |
| Prompt injection indireta | Dados nunca concedem autoridade; validação determinística |
| Permissão excessiva       | Escopo por recurso, operação, duração e limite            |
| Memória falsa             | Origem, confiança, confirmação e correção                 |
| Exfiltração               | Rede allowlist, minimização e confirmação contextual      |
| Encadeamento perigoso     | Risco avaliado sobre o plano inteiro                      |
| Automação descontrolada   | Orçamento, rate limit, circuit breaker e kill switch      |
| Mistura entre projetos    | Isolamento lógico e testes negativos                      |
| Segredos em logs/contexto | Cofre do SO e redação por padrão                          |

## Níveis de risco

- `R0`: raciocínio sem efeito externo.
- `R1`: leitura autorizada.
- `R2`: alteração local reversível.
- `R3`: ação externa ou sensível; confirmação obrigatória.
- `R4`: irreversível, financeira, credenciais ou administração; bloqueada no MVP.

## Fora do MVP

Shell arbitrário, privilégios administrativos, compras, envio autônomo, exclusão permanente, câmera/microfone contínuos, senhas, instalação autônoma e controle irrestrito de dispositivos.
