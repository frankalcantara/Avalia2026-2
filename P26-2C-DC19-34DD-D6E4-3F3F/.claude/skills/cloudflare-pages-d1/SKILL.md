---
name: cloudflare-pages-d1
description: Como escrever Cloudflare Pages Functions com banco D1 neste projeto (roteamento por arquivo, binding DB, consultas parametrizadas, validação no servidor).
---

# Cloudflare Pages Functions + D1

Use esta skill ao criar ou alterar qualquer arquivo em `functions/` ou `wrangler.toml`.

## Roteamento por arquivo
- `functions/api/topics/index.js` responde `/api/topics`.
- `functions/api/topics/[id]/index.js` responde `/api/topics/:id`; o valor chega em `context.params.id`.
- `functions/api/topics/[id]/answers.js` responde `/api/topics/:id/answers`.
- Pastas e arquivos que começam com `_` (ex.: `functions/_lib/`) **não** viram rota.
- Exporte `onRequestGet`, `onRequestPost`, etc. Cada função recebe `{ request, env, params }` e devolve `Response`.

## D1
- Binding `DB` em `wrangler.toml` (`[[d1_databases]]`, `binding = "DB"`).
- Sempre consulta parametrizada: `env.DB.prepare("... WHERE id = ?").bind(id)`. Nunca concatenar entrada do usuário no SQL.
- `.first()` devolve uma linha ou `null`; `.all()` devolve `{ results }`; `.run()` devolve `{ meta: { changes, last_row_id } }`.
- Para `LIKE` com entrada do usuário, escapar `%`, `_` e `\` e usar `ESCAPE '\'`.
- Operações que dependem de permissão viram **uma instrução atômica** com a condição no `WHERE`, e o resultado é conferido em `meta.changes`.

## Regras do projeto
1. A permissão é decidida no servidor com o `user_id` da sessão, nunca com dados do corpo.
2. Validar tipo, tamanho e formato antes de tocar no banco; devolver 422 com `field`.
3. POST exige JSON e `Origin` do mesmo host (proteção CSRF).
4. Erros inesperados: registrar com `console.error` e responder 500 genérico, sem vazar detalhes.
5. Datas em ISO 8601 UTC (`new Date().toISOString()`).

## Checklist antes de entregar
- [ x ] Nenhuma rota confia em `user_id` vindo do cliente.
- [ x ] Todo SQL usa `bind`.
- [ x ] Códigos HTTP conforme `docs/CONTRATO-API.md`.
- [ x ] Nenhum segredo em arquivo versionado (`.dev.vars` está no `.gitignore`).
