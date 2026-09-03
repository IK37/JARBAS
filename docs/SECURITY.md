# Security

Controles atuais:

- API restrita a loopback;
- same-origin derivada do host/porta configurados, allowlist adicional e CSP;
- JSON tipado na fronteira e respostas determinísticas `400/404/409/413/415`;
- body, mensagens, contexto, saída e eventos SSE limitados;
- timeout, backpressure e cancelamento de provider;
- exclusão mútua de turno por sessão e remoção de conteúdo parcial;
- logs sem conteúdo e com redação;
- auditoria de dependências e scanner básico de secrets no CI;
- SQLite com foreign keys, transações e WAL;
- Policy Engine determinístico experimental já existente.

Ainda não implementado: autenticação para rede, criptografia at-rest gerenciada, fallback de runtime, aplicação executável da External Data Policy, sandbox, ToolRegistry executável e recibos de consentimento. O Policy Engine atual não autoriza ferramentas reais até ganhar validação de scopes, grants consumíveis e canonicalização de paths. Portanto a API não deve ser exposta à LAN/Internet.
