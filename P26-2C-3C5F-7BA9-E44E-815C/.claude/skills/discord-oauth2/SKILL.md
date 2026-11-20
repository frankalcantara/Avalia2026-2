---
name: discord-oauth2
description: Fluxo OAuth2 do Discord (authorization code) em Cloudflare Pages Functions, com state anti-CSRF e sessão por cookie.
---
1. `GET /api/auth/login`: gere `state` aleatório, guarde em cookie `oauth_state` (10 min) e redirecione para `https://discord.com/oauth2/authorize` com `scope=identify` e `redirect_uri=<origem>/api/auth/callback`.
2. `GET /api/auth/callback`: compare `state` da URL com o cookie. Troque o `code` em `POST https://discord.com/api/oauth2/token` (form-urlencoded, com client_id e client_secret dos secrets).
3. Leia `GET https://discord.com/api/users/@me`. Faça upsert em `users` (id, nome, avatar).
4. Crie token aleatório, grave o SHA-256 em `sessions` e entregue o token em cookie `HttpOnly; Secure; SameSite=Lax`.
5. Avatar: `https://cdn.discordapp.com/avatars/{id}/{avatar}.png`.
Segredos nunca entram no repositório: use `.dev.vars` local e variáveis secretas no Cloudflare.
