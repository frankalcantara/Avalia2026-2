---
name: cloudflare-d1-oauth
description: Padrões para Pages Functions com D1 e login Discord OAuth2 seguros.
---
- Binding do D1 chama-se `DB`; use sempre `prepare(...).bind(...)`, nunca concatene SQL.
- OAuth: gere `state` aleatório, guarde em cookie de 10 min e compare no callback. Escopo `identify`. `redirect_uri` = `origin + /api/auth/discord/callback`.
- Sessão: token aleatório na tabela `sessions`, cookie `HttpOnly; Secure; SameSite=Lax`, validade de 7 dias.
- Autoria: toda leitura e escrita inclui `AND user_id = ?` com o id vindo da sessão.
- Variáveis: `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` ficam no Cloudflare (ou `.dev.vars` local, no .gitignore).
