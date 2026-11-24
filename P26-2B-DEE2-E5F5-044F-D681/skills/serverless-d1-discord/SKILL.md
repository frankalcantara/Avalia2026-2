---
name: serverless-d1-discord
description: Padrões para Cloudflare Pages Functions com persistência no Cloudflare D1 e login Discord OAuth2. Usar ao criar/alterar qualquer arquivo em functions/ ou migrations/ deste projeto.
---

# Skill: Pages Functions + Cloudflare D1 + Discord OAuth2

Usada pelo **Agente 1 (Arquiteto Serverless)** do projeto #34 — Vitrine de Achados e Perdidos do Campus (`P26-2B-DEE2-E5F5-044F-D681`).

## Estrutura
- `functions/_lib/` — módulos compartilhados (sem `onRequest*`, logo não viram rotas).
- `functions/api/_middleware.js` — carrega a sessão, exige login para toda rota que não esteja na lista de públicas, devolve JSON em erros.
- Uma rota por arquivo, seguindo o roteamento por pastas do Pages (`[id].js` para parâmetros).
- `migrations/NNNN_nome.sql` — único lugar onde o esquema muda. Aplicar com `wrangler d1 migrations apply DB --local|--remote`.

## Regras obrigatórias
1. **O servidor é a fonte da verdade.** Toda regra de negócio (quem pode fazer o quê, transições de status, tamanhos de campo, datas) é validada na Function, mesmo que a interface também valide.
2. **Sempre `prepare(...).bind(...)`.** Nunca concatenar valor vindo do usuário no SQL.
3. **Restrições também no banco:** `CHECK` para enums e tamanhos, `UNIQUE` parcial para "uma reivindicação ativa por pessoa por item", chaves estrangeiras.
4. **Transições atômicas:** mudanças que tocam mais de uma tabela vão em `env.DB.batch([...])` com `UPDATE ... WHERE status = <esperado>` para evitar condição de corrida; se a primeira instrução não alterou nada, responder `409`.
5. **Códigos HTTP corretos:** 400 validação, 401 sem login, 403 sem permissão, 404 inexistente, 409 conflito de estado, 415 content-type, 429 limite.
6. **Escritas só com `Content-Type: application/json`** e `Origin` igual ao do site (proteção CSRF junto com `SameSite=Lax`).

## Discord OAuth2
- Escopo `identify` apenas. Importar `id` (user_id), `username`, `global_name` e `avatar`.
- `state` aleatório em cookie HttpOnly de 10 min, comparado no callback.
- `redirect_uri` = `<origin>/api/auth/discord/callback` — idêntico ao cadastrado no Discord Developer Portal.
- Sessão: token aleatório de 32 bytes no cookie `sid` (HttpOnly, Secure, SameSite=Lax, 7 dias); no D1 guardar **só o SHA-256** do token.
- `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` ficam em Secrets da Cloudflare / `.dev.vars`, nunca no Git.

## Contrato da API (resumo)
| Método | Rota | Login | Descrição |
|---|---|---|---|
| GET | /api/status | não | diagnóstico D1/Discord |
| GET | /api/me | não | usuário logado ou `null` |
| GET | /api/auth/discord | não | inicia OAuth2 |
| GET | /api/auth/discord/callback | não | finaliza OAuth2 |
| POST | /api/auth/logout | não | encerra sessão |
| GET | /api/items | não | lista (filtros: tipo, categoria, status, q, meus=1) |
| POST | /api/items | sim | cadastra item |
| PATCH | /api/items/:id | sim (dono) | `{acao:"encerrar"}` |
| POST | /api/items/:id/claims | sim | abre reivindicação `{mensagem}` |
| GET | /api/claims | sim | minhas reivindicações (como dono ou reivindicante) com contatos |
| PATCH | /api/claims/:id | sim | `{acao: aceitar|recusar|cancelar|concluir}` |
