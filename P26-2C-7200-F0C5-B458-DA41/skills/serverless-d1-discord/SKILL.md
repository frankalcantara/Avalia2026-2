---
name: serverless-d1-discord
description: Como construir o backend do Issue Tracker em Cloudflare Pages Functions + D1 com login Discord OAuth2, mantendo todas as regras de negócio no servidor. Use ao criar ou alterar qualquer arquivo em functions/ ou migrations/.
---

# Skill: Backend Serverless (Cloudflare Pages Functions + D1 + Discord OAuth2)

## Contexto
Projeto #38 — Rastreador de Solicitações e Chamados Internos. Chave `P26-2C-7200-F0C5-B458-DA41`.
O cliente é **não confiável**: tudo que chega em `/api/*` é revalidado no servidor.

## Estrutura obrigatória
```
functions/
  _lib/rules.js      ← regras PURAS (sem I/O): validação, máquina de estados, permissões, código do chamado
  _lib/session.js    ← sessões em D1 (cookie HttpOnly com token aleatório; D1 guarda só o SHA-256)
  _lib/http.js       ← json(), fail(), readJson() com limite, sameOrigin() anti-CSRF
  _lib/tickets.js    ← consultas de chamado + linha do tempo
  api/auth/discord.js            GET  → redireciona ao Discord com state anti-CSRF
  api/auth/discord/callback.js   GET  → confere state, troca code, importa user_id/nome/avatar
  api/auth/logout.js             POST
  api/me.js                      GET  → usuário + rótulos de estados/severidades
  api/tickets/index.js           GET lista / POST abre
  api/tickets/[code].js          GET detalhe + eventos
  api/tickets/[code]/comments.js POST comentário
  api/tickets/[code]/status.js   POST mudança de estado
migrations/0001_init.sql
```

## Regras
1. **Toda regra de negócio mora em `_lib/rules.js`** e é importada pelas rotas. Assim o agente de teste consegue testá-la com `node --test` sem Cloudflare.
2. **SQL sempre parametrizado** (`prepare(...).bind(...)`). Nunca concatenar valores do usuário. Em `LIKE`, escapar `%`, `_` e `\`.
3. **Respostas de erro com o código HTTP certo:** 400 JSON inválido · 401 sem login · 403 sem permissão / origem estranha · 404 não existe · 409 conflito de estado · 422 validação · 429 limite · 503 D1 não vinculado.
4. **Máquina de estados** (`TRANSITIONS`): aberto → em_analise | resolvido; em_analise → aguardando | resolvido; aguardando → em_analise | resolvido; resolvido é final.
5. **Permissões:** técnicos (IDs em `ADMIN_DISCORD_IDS`) fazem qualquer transição válida; o autor só pode marcar o próprio chamado como resolvido. Comentários: qualquer usuário logado, até o chamado ser resolvido.
6. **Concorrência:** o `UPDATE` de estado usa `WHERE status = <estado lido>`; se `changes = 0`, devolver 409.
7. **Cada mudança gera um evento** em `ticket_events` (kind `criado` | `status` | `comentario`) — é daí que sai a linha do tempo.
8. **OAuth2 Discord:** escopo `identify`; `redirect_uri` = `<origin>/api/auth/discord/callback`; `state` aleatório em cookie HttpOnly de 10 min; segredos só em variáveis de ambiente (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`), nunca no repositório.
9. Mutações (`POST`) exigem `Origin` igual ao host (`sameOrigin`).

## Checklist antes de entregar
- [ ] `node --test` (ou `npm test`) passa
- [ ] `wrangler d1 migrations apply DB --local` aplica sem erro
- [ ] Nenhum segredo commitado (`.dev.vars` está no `.gitignore`)
