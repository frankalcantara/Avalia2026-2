---
name: serverless-d1-discord
description: Padrões para Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e login Discord OAuth2. Use ao criar ou alterar qualquer arquivo em functions/, src/lib/ ou migrations/.
---

# Skill: Back-end serverless (Cloudflare Pages Functions + D1 + Discord OAuth2)

## Quando usar
Sempre que a tarefa envolver rotas `/api/*`, regras de negócio, esquema do banco ou autenticação.

## Estrutura obrigatória
- Rotas em `functions/api/**` (roteamento por arquivo das Pages Functions; parâmetros dinâmicos com `[id].js`).
- Lógica compartilhada e testável em `src/lib/*.js` (funções puras, sem depender do runtime).
- Esquema em `migrations/NNNN_descricao.sql`, aplicado com `wrangler d1 migrations apply DB`.
- Binding do banco sempre chamado `DB` (`env.DB`).

## Regras
1. **O servidor decide.** Toda validação de entrada e todo cálculo que vira dado (métricas, limites, datas permitidas) roda nas Functions. O cliente só exibe.
2. **SQL parametrizado.** Sempre `env.DB.prepare("... ?").bind(valor)`. Nunca concatenar texto do usuário em SQL.
3. **Escopo por usuário.** Toda consulta a hábitos/marcações filtra por `user_id` da sessão. Recurso de outro usuário responde `404` (não revela que existe).
4. **Códigos HTTP corretos:** `400` parâmetro malformado, `401` sem sessão, `403` origem cruzada, `404` não encontrado, `409` conflito (duplicado/limite), `415` Content-Type errado, `422` regra de negócio violada.
5. **Idempotência:** `PUT` marca (INSERT OR IGNORE) e `DELETE` desmarca; repetir não muda o resultado.
6. **Datas em UTC como `AAAA-MM-DD`.** O "hoje" do cliente só é aceito se estiver a no máximo 1 dia do UTC (`resolveToday`).

## Discord OAuth2
- `GET /api/auth/discord`: gera `state` aleatório, grava em cookie `HttpOnly` (10 min, `Path=/api/auth`) e redireciona para `https://discord.com/oauth2/authorize` com `scope=identify`.
- `GET /api/auth/discord/callback`: compara `state`; troca `code` em `https://discord.com/api/oauth2/token` usando `DISCORD_CLIENT_SECRET` (nunca no cliente); lê `https://discord.com/api/users/@me`; faz *upsert* de `user_id`, `username`, `global_name` e avatar em `users`.
- Avatar: `cdn.discordapp.com/avatars/{id}/{hash}.png` (ou `.gif` se o hash começar com `a_`); sem avatar, `cdn.discordapp.com/embed/avatars/{(id >> 22) % 6}.png`.

## Sessões
- Cookie `ht_session` com token aleatório de 32 bytes, `HttpOnly; Secure; SameSite=Lax`, 30 dias.
- No D1 fica apenas o `SHA-256` do token (`sessions.token_hash`) com `expires_at`. Logout apaga a linha.

## Checklist antes de entregar
- [ ] Nova rota tem teste em `tests/api.test.mjs` cobrindo 401 e o caso feliz.
- [ ] Nova regra tem função pura em `src/lib/` com teste unitário.
- [ ] Mudança de esquema virou uma nova migration (não editar migration já aplicada em produção).
