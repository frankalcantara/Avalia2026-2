---
name: serverless-d1-discord
description: Padrões para Cloudflare Pages Functions com D1 e login Discord OAuth2 (PKCE, sessão opaca, autoria vinda do servidor). Use ao mexer em functions/ ou migrations/.
---

# Cloudflare Pages Functions + D1 + Discord OAuth2

## Estrutura
- `functions/api/**` mapeia para rotas `/api/**`; `[id].js` e `[codigo].js` são parâmetros.
- Exporte `onRequestGet`, `onRequestPost`, `onRequestPatch`, `onRequestPut`, `onRequestDelete`.
- Banco: binding `DB`. Use `env.DB.prepare(sql).bind(...).first() | .all() | .run()` e `env.DB.batch([...])`.

## Login Discord
1. `/api/auth/discord`: gerar `state` e `code_verifier` aleatórios, guardar em cookies `__Host-` de 10 min, redirecionar para `https://discord.com/oauth2/authorize` com `scope=identify`, `code_challenge` (SHA-256 base64url do verifier) e `code_challenge_method=S256`.
2. `/api/auth/discord/callback`: comparar `state` com o cookie; trocar `code` em `POST https://discord.com/api/oauth2/token` (com `client_secret` e `code_verifier`); ler `GET https://discord.com/api/users/@me`; gravar `id`, `username`, `global_name`, `avatar` em `users`.
3. Criar sessão: token aleatório no cookie `__Host-session` (HttpOnly, Secure, SameSite=Lax); no D1 só o SHA-256 do token.

## Regras de negócio
- A identidade do usuário vem da sessão, nunca do JSON enviado.
- Validar toda entrada em `functions/_lib/validacao.js` antes de tocar no banco.
- Escritas exigem `Origin` igual ao do site e `Content-Type: application/json`.
- Permissões (autor edita/remove) são verificadas no servidor e repetidas no `WHERE` do `UPDATE`/`DELETE`.
- SQL sempre parametrizado; nunca concatenar entrada do usuário.
- Segredos (`DISCORD_CLIENT_SECRET`) só como variável secreta do Pages, nunca no repositório.
