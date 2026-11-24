---
name: cloudflare-d1-discord
description: >
  Implementa e revisa a camada serverless do projeto no Cloudflare Pages
  Functions + D1 com login Discord OAuth2. Use ao criar endpoints, migrações,
  sessões, cookies, bindings D1 ou ao revisar segurança de rotas serverless.
license: MIT
---

# Cloudflare D1 + Discord OAuth2 (P26-2A-B12E-0CFD-70CA-18E1)

Skill operacional do Agente 1 (Arquiteto Serverless). Toda regra de negócio
vive no servidor; o navegador só apresenta dados e dispara ações.

## Contratos do projeto

- **Stack:** Cloudflare Pages Functions (ES Modules, sem framework), D1 (SQLite),
  Discord OAuth2 com escopo `identify` apenas.
- **Segredo:** `DISCORD_CLIENT_SECRET` nunca entra no repositório. Localmente
  fica em `.dev.vars` (gitignored); em produção, `wrangler pages secret put`.
- **Sessão:** token aleatório de 32 bytes no cookie `sorteio_sessao`
  (`HttpOnly; Secure; SameSite=Lax`); o D1 guarda apenas `sha256(token)` na
  tabela `sessions`.
- **CSRF:** `state` aleatório em cookie HttpOnly no login + checagem de
  `Origin` em todo método que altera estado (`verificarOrigem`).
- **SQL:** sempre `prepare(...).bind(...)`. Escritas compostas usam
  `env.DB.batch([...])`, que é transacional no D1.
- **Erros:** `responderErro` padroniza `{ ok:false, erro, mensagem }`; nunca
  vaze stack trace, SQL ou token para o cliente.

## Arquivos-chave

| Arquivo | Responsabilidade |
|---|---|
| `migrations/0001_init.sql` | schema, CHECKs, índices e triggers de imutabilidade |
| `functions/_lib/crypto.js` | SHA-256, `randomInt` sem viés, JSON canônico |
| `functions/_lib/db.js` | todas as queries preparadas |
| `functions/_lib/http.js` | JSON, cookies, leitura de corpo, origem, erros |
| `functions/_lib/sessao.js` | criar/ler/encerrar sessão |
| `functions/_lib/discord.js` | URL de autorização, troca de code, perfil, avatar |
| `functions/_middleware.js` | cabeçalhos de segurança + erro global |
| `wrangler.jsonc` | binding `DB` + `pages_build_output_dir` |

## Fluxo OAuth2 correto

1. `GET /api/auth/discord?next=/caminho` gera `state`, grava cookie
   `sorteio_oauth_state` (10 min, path `/api/auth/discord`) e redireciona.
2. Callback confere `state`, troca o `code` em
   `https://discord.com/api/oauth2/token`, busca `GET /users/@me`.
3. Persiste **apenas** `id`, `username`, `global_name`, `avatar` em
   `discord_users`; cria sessão; limpa o cookie de state; redireciona para
   `next` validado por `destinoSeguro` (só caminhos internos).
4. Logout é `POST`, apaga a linha de `sessions` e expira o cookie.

Nunca use `btoa(JSON.stringify(perfil))` como sessão: o cookie fica forjável.
Nunca aceite `next` absoluto, `//host` ou com `\` (open redirect).

## Regras de D1 que já custaram bug

- `CHECK` que resulta em `NULL` **não falha** no SQLite. Para exigir inteiro,
  combine `typeof(coluna) = 'integer'` com o intervalo.
- `UNIQUE(room_id, user_id)` permite vários `NULL` (participantes manuais) e
  bloqueia duplicidade de usuário Discord na mesma sala.
- `draws` e `draw_entries` são append-only: triggers `BEFORE UPDATE/DELETE`
  chamam `RAISE(ABORT, ...)`. Não tente “corrigir” ata com UPDATE.
- Excluir sala com ata é bloqueado pela FK de `draws` (sem CASCADE). A API
  responde 409 antes de chegar ao banco.
- Timestamps são ISO-8601 UTC com milissegundos, gerados pela Function.

## Checklist antes de concluir

```powershell
node --test tests/                     # unitários + schema
npx.cmd wrangler d1 execute DB --local --file=migrations/0001_init.sql
npx.cmd wrangler pages dev public --port 8788
```

- [ ] rota sem sessão devolve 401; não-dono devolve 403
- [ ] `Origin` externo em POST/PATCH/DELETE devolve 403
- [ ] segredo não aparece em `git grep` nem em resposta HTTP
- [ ] cookie de sessão tem `HttpOnly`, `SameSite=Lax` e `Secure` em HTTPS
- [ ] query nova usa `bind` e tem índice quando filtra por coluna quente
- [ ] `wrangler.jsonc` mantém o binding `DB` e o diretório `public`

## Comandos de deploy (Fase 7)

```powershell
npx.cmd wrangler d1 create db-p26-2a-b12e-0cfd-70ca-18e1
# copie o database_id para wrangler.jsonc
npx.cmd wrangler d1 migrations apply DB --remote
npx.cmd wrangler pages secret put DISCORD_CLIENT_SECRET --project-name <projeto>
```

No portal do Discord, o Redirect precisa ser exatamente
`https://<deploy>/api/auth/discord/callback`.
