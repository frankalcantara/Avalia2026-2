---
name: serverless-d1-discord
description: Padrões para implementar Cloudflare Pages Functions com Cloudflare D1 e login Discord OAuth2 — sessões seguras, regras de negócio no servidor e checkout transacional. Use ao escrever ou revisar qualquer arquivo em functions/ ou migrations/.
---

# Skill: Backend Serverless — Pages Functions + D1 + Discord OAuth2

Usada pelo **Agente 2 (Backend)**. Fonte da verdade: `docs/CONTRATO-API.md`.
Se o contrato e esta skill divergirem, o contrato vence e a divergência é
relatada ao orquestrador.

## 1. Estrutura de rotas
- Arquivos em `functions/api/...` exportam `onRequestGet`, `onRequestPost` etc.
  Rotas dinâmicas usam `[id].js`. Código compartilhado fica em
  `functions/_lib/` (prefixo `_` não vira rota).
- **Não** criar catch-all `functions/api/[[path]].js`: quando uma rota casa o
  caminho mas não o método, o Pages cai no próximo handler e o 405 automático
  vira 404. Para 404 JSON em `/api/*`, usar `functions/api/_middleware.js`
  que chama `next()` e converte uma resposta `text/html` em 404 JSON.
- Respostas sempre JSON com `{ ok, error, message }` nos erros.

## 2. D1
- Sempre `env.DB.prepare(sql).bind(...)`. Nunca interpolar valores em SQL.
- Valores monetários são `INTEGER` (créditos). Nunca `REAL`.
- Operações que precisam ser atômicas vão num único `env.DB.batch([...])` —
  é uma transação: se uma instrução falha, todas são desfeitas.
- Use os `CHECK (... >= 0)` do esquema como trava contra corrida: faça o
  `UPDATE ... SET balance = balance - ?` sem depender só da leitura anterior;
  se o saldo ficar negativo o CHECK falha e o lote volta atrás. Capture o
  erro e responda 409 `conflict_retry`.
- IDs de pedido gerados no servidor com `crypto.randomUUID()` para poder
  inserir `orders` e `order_items` no mesmo lote.

## 3. Discord OAuth2
1. `/api/auth/discord`: gerar `state` com `crypto.getRandomValues`, gravar em
   cookie `oauth_state` (HttpOnly, Secure, SameSite=Lax, Max-Age=600) e
   redirecionar para `https://discord.com/oauth2/authorize` com
   `response_type=code`, `scope=identify`, `redirect_uri` derivado de
   `new URL(request.url).origin + "/api/auth/discord/callback"`.
2. Callback: comparar `state` da query com o cookie; trocar `code` em
   `POST https://discord.com/api/oauth2/token` (form-urlencoded); ler
   `GET https://discord.com/api/users/@me` com `Bearer`.
3. Importar `id` (user_id), `global_name || username` e avatar
   (`https://cdn.discordapp.com/avatars/{id}/{hash}.png`, ou avatar padrão
   `https://cdn.discordapp.com/embed/avatars/{(BigInt(id) >> 22n) % 6n}.png`).
4. Upsert: `INSERT ... ON CONFLICT(user_id) DO UPDATE SET username, avatar,
   updated_at` — o saldo inicial só é aplicado no INSERT (primeiro login).
5. Sessão: token aleatório de 32 bytes no cookie `sid`; no D1 guardar só o
   SHA-256 (`crypto.subtle.digest`). Expiração verificada em toda leitura.
6. Segredos (`DISCORD_CLIENT_SECRET`) só via variáveis de ambiente do Pages
   ou `.dev.vars` local — nunca no repositório.

## 4. Segurança das rotas de escrita
- Toda rota `POST` exige sessão válida (401) e, se houver header `Origin`,
  que ele seja igual à origem da requisição (403 `forbidden_origin`).
- Nunca aceitar do cliente: preço, total, saldo, user_id. Tudo vem do D1 e
  da sessão.
- Validar tipos e limites (inteiros, faixas) antes de tocar no banco → 400.

## 5. Checklist antes de entregar
- [ ] Cada rota do contrato existe e responde no formato documentado.
- [ ] Nenhum SQL com concatenação de valores.
- [ ] Checkout com `batch()` e tratamento de erro de CHECK.
- [ ] `PUT /api/checkout` continua dando 405; `/api/xyz` dá 404 JSON.
