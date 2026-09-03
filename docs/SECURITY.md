# Security

Controles atuais:

- API restrita a loopback;
- allowlist de Origin e CSP;
- body e mensagens limitados;
- timeout e cancelamento de provider;
- logs sem conteúdo e com redação;
- SQLite com foreign keys, transações e WAL;
- Policy Engine determinístico já existente.

Ainda não implementado: autenticação para rede, criptografia at-rest gerenciada, sandbox de executores, ToolRegistry executável e recibos de consentimento. Portanto a API não deve ser exposta à LAN/Internet.
