---
name: deploy-cloudflare-pages
description: Publicação automática do projeto no Cloudflare Pages com D1 — migrações remotas, secret do Discord, deploy por wrangler e verificação pós-deploy. Usar sempre que for publicar uma nova versão.
---

# Skill: Publicação no Cloudflare Pages + D1

Complementa `skills/cloudflare-oficial/wrangler/SKILL.md` (regras gerais do Wrangler). Use o
Wrangler **local do projeto** (`npx wrangler`, versão fixada no `package.json`), com Node ≥ 20.

## Alvos fixos deste projeto
| Item | Valor |
|---|---|
| Projeto Pages | `achados-perdidos-campus` (branch de produção `main`) |
| URL | https://achados-perdidos-campus.pages.dev |
| D1 | `db-p26-3a-5e56-230d-1716-d540` → binding `DB` (em `wrangler.jsonc`) |
| Variável | `DISCORD_CLIENT_ID` (em `wrangler.jsonc` → `vars`) |
| Secret | `DISCORD_CLIENT_SECRET` (só no Pages, **nunca** em arquivo versionado) |

> Com `wrangler.jsonc` presente, o Pages usa **o arquivo** como fonte de bindings e variáveis
> (as do painel são ignoradas). Secrets continuam vindo do Pages.

## Roteiro (parar no primeiro erro)
1. **Pré-voo**: `npx wrangler whoami` mostra a conta pessoal da faculdade; `git status` limpo
   ou só com o que vai subir; testes do agente de validação passaram (`npm test`).
2. **Migrações** (idempotentes, numeradas): `npx wrangler d1 migrations list DB --remote` e depois
   `npx wrangler d1 migrations apply DB --remote`. Nunca editar migração já aplicada: criar a próxima.
3. **Secret** (só na 1ª vez ou ao trocar): `npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name achados-perdidos-campus`
   — o valor é digitado pelo dono no prompt; nunca passar por argumento nem colar em chat/log.
4. **Deploy**: `npx wrangler pages deploy --project-name achados-perdidos-campus --branch main --commit-dirty=true`
   executado **de dentro da pasta da chave** (assim `functions/` é compilado junto).
5. **Pós-deploy** (smoke test):
   - `GET /` → 200 e contém `P26-3A-5E56-230D-1716-D540`;
   - `GET /api/status` → `{ d1: true, oauth_configurado: true }`;
   - `GET /api/auth/discord` → 302 para `discord.com`;
   - cabeçalhos de segurança presentes (`curl -sI`).
6. **Rollback**: `npx wrangler pages deployment list --project-name achados-perdidos-campus` e
   promover o deploy anterior pelo painel (Deployments → ⋯ → Rollback). Migrações não voltam sozinhas.

## Automação
`npm run deploy` faz o passo 4. A sequência completa (1→5) roda em `scripts/publicar.sh`.
