---
name: serverless-d1-discord
description: Padrões para Cloudflare Pages Functions com D1 e login Discord OAuth2 — sessão opaca no servidor, queries parametrizadas, validação de regra de negócio na borda e isolamento por usuário. Use ao criar ou alterar qualquer arquivo em functions/ ou migrations/.
---

# Skill: Serverless Cloudflare Functions + D1 + Discord OAuth2

## Quando usar
Qualquer mudança em `functions/**` ou `migrations/**` do projeto.

## Regras obrigatórias
1. **Contrato primeiro.** Siga `docs/CONTRATO-API.md` à risca (rotas, códigos HTTP, formato JSON). Mudou o contrato? Atualize o documento no mesmo passo.
2. **Nunca confie no cliente.** Todo corpo recebido passa por `validarDisciplina()` de `public/js/calculo.js` antes de tocar no banco. O `resumo` devolvido é recalculado no servidor com `calcular()`.
3. **Sessão opaca.** Cookie `sid` guarda só um token aleatório (`crypto.getRandomValues`, 32 bytes, hex). O `user_id` vem da tabela `sessions`, nunca do cookie ou do corpo. Cookie: `HttpOnly; Secure; SameSite=Lax; Path=/`.
4. **OAuth2 com `state`.** `/api/auth/discord` grava `oauth_state` em cookie e o callback compara antes de trocar o `code` (proteção CSRF).
5. **Isolamento por usuário.** Toda query de disciplina/avaliação filtra por `user_id` da sessão. Recurso de outro usuário responde `404` (não vaza existência).
6. **SQL parametrizado.** Sempre `env.DB.prepare("... ?").bind(...)`. Nada de concatenar string em SQL.
7. **Escrita atômica.** Substituição de avaliações usa `env.DB.batch([...])`.
8. **Middleware único.** Autenticação em `functions/api/_middleware.js`, expondo `context.data.user`; rotas `/api/auth/*` são públicas.
9. **Segredos fora do repositório.** `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` só em variáveis do Pages (secret) ou `.dev.vars` local (no `.gitignore`).

## Checklist antes de entregar
- [ ] `npx wrangler pages dev` sobe sem erro e `/api/me` sem cookie responde 401
- [ ] POST com peso 0, nota > notaMax ou tipo inválido → 400
- [ ] PUT/DELETE em id de outro usuário → 404
