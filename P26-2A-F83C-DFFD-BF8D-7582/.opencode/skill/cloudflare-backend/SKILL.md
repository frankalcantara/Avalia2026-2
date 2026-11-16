---
name: cloudflare-backend
description: Regras operacionais de Cloudflare Pages Functions, D1, sessão HMAC e Discord OAuth2 no Projeto #14.
---

# Backend Serverless — regras operacionais

## Invariantes

- Só Cloudflare Pages Functions em `functions/api/**` (`onRequestGet`/`onRequestPost`), binding `env.DB`.
- Discord OAuth2 (`scope=identify`) é o único login; `state` anti-CSRF obrigatório.
- Sessão HMAC-SHA256 em cookie `session` (`HttpOnly`, `SameSite=Lax`, `Secure` em HTTPS).
- `criado_em` sempre `new Date().toISOString()` no servidor; ignorar data do cliente.
- `GET /api/logs` sempre `WHERE user_id = ?` com o `user_id` da sessão.
- Queries parametrizadas (`prepare().bind()`), nunca interpolação.
- Erros: `400` validação, `401` sem sessão, `500` genérico, `503` sem DB, `201` criação.

## Contratos

```text
POST /api/logs  {conteudo, impedimento} -> 201 {success,id,criado_em}
GET  /api/logs?busca&impedimento&inicio&fim -> 200 [logs]
GET  /api/auth/me -> 200 {user_id,username,avatar} | 401
GET  /api/auth/me?logout=1 -> 200 {success} + Max-Age=0
```

- `inicio` → `${inicio}T00:00:00.000Z`; `fim` → `${fim}T23:59:59.999Z`.
- Ordem: `criado_em DESC, id DESC`.
- Aliases: `/api/auth/discord` → `/api/auth/login`; `/api/auth/discord/callback` → `/api/auth/callback` preservando query.

## Antes de concluir

- [ ] `node --test tests/api.test.mjs` verde.
- [ ] Schema em `migrations/0001_init.sql` (+ `schema.sql`) e índice `idx_logs_user_criado`.
- [ ] Nenhum segredo no repositório.
- [ ] Guia completo: `skills/cloudflare-backend/SKILL.md`.
