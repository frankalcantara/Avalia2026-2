---
name: cloudflare-pages-d1
description: Convenções para escrever Cloudflare Pages Functions com D1 e OAuth2 do Discord neste projeto. Use ao criar ou alterar arquivos em functions/ ou migrations/.
---

# Cloudflare Pages Functions + D1 + Discord OAuth2

## Regras
- Cada arquivo em `functions/` exporta handlers `onRequestGet`, `onRequestPost`, etc., recebendo `{ request, env }`.
- Acesse o banco por `env.DB` (D1). Use SEMPRE `env.DB.prepare(sql).bind(...)` com parâmetros; nunca concatene entrada do usuário no SQL.
- Segredos (`DISCORD_CLIENT_SECRET`) só via `env`; nunca no repositório.
- Valide tudo no servidor: o remetente do kudo vem da sessão, nunca do corpo da requisição.
- Sessão: token aleatório (`crypto.getRandomValues`), guardar só o SHA-256 (`crypto.subtle.digest`) no D1; cookie HttpOnly + SameSite=Lax (+ Secure fora de localhost).
- OAuth: `state` aleatório de uso único com expiração; escopo `identify`.
- Respostas JSON com helper único (`functions/_lib/http.js`); erros no formato `{ error }`.
- Arquivos em `functions/_lib/` não viram rotas (prefixo `_`).
- Migrações: `wrangler d1 migrations apply kudos-board-db --local|--remote`.

## Verificação
- `node --test tests/` roda os testes com um D1 simulado sobre `node:sqlite`.
