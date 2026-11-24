---
name: serverless-d1-discord
description: Padrões para implementar Cloudflare Pages Functions com persistência no Cloudflare D1 e login Discord OAuth2, com todas as regras de negócio validadas no servidor. Use ao criar ou alterar qualquer arquivo em functions/, src/ ou migrations/.
---

# Skill: Backend Serverless — Pages Functions + D1 + Discord OAuth2

## Antes de escrever código
1. Leia `docs/API.md` (contrato) e `migrations/0001_init.sql` (esquema). O contrato manda; se precisar mudar, mude o contrato primeiro e avise.
2. Roteamento por arquivo: `functions/api/books/[id].js` atende `/api/books/:id` (`context.params.id`). Exporte `onRequestGet`, `onRequestPost`, `onRequestPatch`, `onRequestDelete`. Método não exportado → 405 automático.
3. Código compartilhado fica em `src/` (importado com caminho relativo), nunca em arquivos de rota.

## Regras obrigatórias
1. **Identidade só no servidor.** O cookie `session` carrega um token aleatório (`crypto.getRandomValues`, 32 bytes hex) que é procurado na tabela `sessions`. Nunca coloque `user_id`, nome ou papel em cookie, query ou corpo como fonte de verdade.
2. **OAuth2 com `state`.** `/api/auth/discord` gera `state` aleatório, grava em cookie `oauth_state` HttpOnly (Max-Age 600) e o callback rejeita se não bater. `scope=identify`. `redirect_uri` = `origin + /api/auth/discord/callback`.
3. **Importe do Discord:** `id` → `user_id`, `username` → `username` (handle de contato), `global_name` → `display_name`, avatar → `https://cdn.discordapp.com/avatars/{id}/{hash}.png` (ou `embed/avatars/{(BigInt(id) >> 22n) % 6n}.png` sem avatar).
4. **Queries sempre parametrizadas:** `env.DB.prepare("... ?").bind(...)`. Nunca concatene entrada do usuário em SQL; no `LIKE`, escape `%`, `_` e `\` e use `ESCAPE '\'`.
5. **Valide toda entrada:** tipo, enum, tamanho (`trim()` antes), inteiros positivos para ids. Rejeite campos que o cliente não pode definir (`status`, `owner_id`, `holder_id`) — ignore-os silenciosamente.
6. **Autorização por recurso:** carregue o registro e compare `owner_id`/`requester_id` com o usuário da sessão antes de qualquer escrita. Falhou → 403 (ou 404 se o recurso não existe).
7. **Transições atômicas:** use `env.DB.batch([...])` com `UPDATE ... WHERE id = ? AND status = ?` e confira `results[i].meta.changes`; zero mudanças = outro pedido venceu → `409`. Nunca "ler, decidir em JS e gravar" sem a condição no `WHERE`.
8. **CSRF:** POST/PATCH com corpo exigem `Content-Type: application/json` (senão `415`). Cookies `SameSite=Lax`.
9. **Erros padronizados:** `{ error, message }` com o status HTTP do contrato. Nunca vaze stack trace; registre com `console.error`.
10. **Segredos:** `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` vêm de `env` (Pages → Settings → Variables). Localmente, em `.dev.vars` (no `.gitignore`).

## Verificação rápida
- `npx wrangler d1 migrations apply DB --local`
- `npx wrangler pages dev public --port 8788`
- `curl -s localhost:8788/api/status` deve responder `d1: true`.
