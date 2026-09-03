# Privacy

Local-first é o padrão. `PUBLIC` pode sair; `PERSONAL` e `PRIVATE` exigem confirmação e minimização; `SECRET` e `RESTRICTED` nunca saem.

Conteúdo de conversa não é registrado em logs. Credenciais e Bearer tokens são redigidos. A política versionada está em `configs/privacy.json`; regras locais mais restritivas poderão sobrepor essa base.

O usuário continuará podendo exportar, corrigir e excluir memórias quando o módulo de memória for implementado.
