---
name: d1-cloudflare-functions
description: Padrões para Cloudflare Pages Functions com D1 e OAuth2 do Discord neste projeto.
---

# Cloudflare Functions + D1

- Rotas por arquivo: `functions/api/quotes/index.js` -> `/api/quotes`; `[id].js` -> `/api/quotes/:id`. Rotas estáticas (`random.js`) têm prioridade sobre dinâmicas.
- Exporte `onRequestGet`, `onRequestPost`, `onRequestPut`, `onRequestDelete`.
- Banco: `env.DB.prepare("... ?1 ...").bind(v).first() | .all() | .run()`. Sempre parametrizado.
- Busca: `LIKE ? ESCAPE '\'` com `likePattern()` (escapa `%` e `_`).
- Sessão: cookie `session` assinado com HMAC (`functions/_lib/auth.js`), `HttpOnly; Secure; SameSite=Lax`.
- OAuth2: `login` gera `state` (cookie), `callback` confere `state`, troca `code` por token, lê `/users/@me`, faz upsert em `users`.
- Redirect URI cadastrada no Discord: `https://SEU-PROJETO.pages.dev/api/auth/callback` (e `http://localhost:8788/api/auth/callback` em dev).
- Variáveis: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` (Pages > Settings > Variables and Secrets).
