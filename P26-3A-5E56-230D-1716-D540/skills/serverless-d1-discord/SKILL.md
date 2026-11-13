---
name: serverless-d1-discord
description: Como escrever o back-end do projeto em Cloudflare Pages Functions + D1 com login Discord OAuth2 — estrutura de rotas, sessão segura, validação no servidor e SQL parametrizado. Usar ao criar ou alterar qualquer arquivo em functions/ ou migrations/.
---

# Skill: Back-end serverless (Pages Functions + D1 + Discord OAuth2)

O contrato está em `docs/ESPECIFICACAO.md`. **Leia antes de escrever código.** Se o contrato
estiver ambíguo, escolha a opção mais restritiva e anote a decisão no fim do arquivo.

## Estrutura de arquivos

```
functions/
  _middleware.js            # erros JSON, CSRF (Origin), cabeçalhos de segurança, carrega sessão
  _lib/                     # código compartilhado (prefixo _ = não vira rota)
    http.js                 # json(), erro(), lerJson() com limite de tamanho e content-type
    sessao.js               # criar/ler/apagar sessão; cookies
    validacao.js            # validadores puros (testáveis com node --test)
  api/auth/discord.js       # GET → redirect para o Discord (com state)
  api/auth/discord/callback.js
  api/auth/logout.js
  api/me.js
  api/itens/index.js        # GET lista, POST cria
  api/itens/[id].js         # GET detalhe, DELETE
  api/itens/[id]/encerrar.js
  api/itens/[id]/reivindicacoes.js
  api/reivindicacoes/index.js
  api/reivindicacoes/[id]/[acao].js   # aceitar | recusar | cancelar
migrations/0001_init.sql, 0002_...sql
```

Handlers: `export async function onRequestGet(context)` / `onRequestPost` / `onRequestDelete`.
`context.env.DB` é o D1, `context.params.id` o parâmetro, `context.data` é compartilhado com o middleware
(o middleware coloca `context.data.usuario`).

## Regras de código

1. **SQL só com `env.DB.prepare(sql).bind(...)`.** Nunca interpolar valor de usuário em SQL. Filtros
   dinâmicos: montar a lista de cláusulas com `?` e um array de parâmetros.
2. **Transições de estado atômicas.** Use `UPDATE ... WHERE id = ? AND status = 'esperado'` e confira
   `meta.changes`; se 0, responda `409`. Várias escritas ligadas → `env.DB.batch([...])`.
3. **Validação no servidor sempre**, mesmo que o front valide. Funções de validação puras em
   `_lib/validacao.js`, retornando `{ ok, valor, erros }`.
4. **Token e state com `crypto.getRandomValues`** (32 bytes, base64url). Nunca `Math.random()`.
   No banco, só o SHA-256 do token (`crypto.subtle.digest`).
5. **Comparar `state` em tempo constante.**
6. **Cookies**: `HttpOnly; Secure; SameSite=Lax; Path=/`. Em `http://localhost` o `Secure` é aceito pelos navegadores.
7. **Nunca vazar detalhe interno**: erro inesperado → `500 {erro:"interno"}` e `console.error` com contexto.
8. **Segredo** (`DISCORD_CLIENT_SECRET`) só em `env`, vindo de secret do Pages ou `.dev.vars` local.
9. Datas em UTC ISO (`datetime('now')` no SQLite).

## Discord OAuth2 — referência rápida

- Authorize: `https://discord.com/oauth2/authorize?client_id=…&redirect_uri=…&response_type=code&scope=identify&state=…&prompt=none`
- Token: `POST https://discord.com/api/oauth2/token` (form-urlencoded: client_id, client_secret,
  grant_type=authorization_code, code, redirect_uri)
- Perfil: `GET https://discord.com/api/users/@me` com `Authorization: Bearer <access_token>`
- Avatar: `https://cdn.discordapp.com/avatars/{id}/{avatar}.png?size=128`; sem avatar →
  `https://cdn.discordapp.com/embed/avatars/{(BigInt(id) >> 22n) % 6n}.png`
- O `redirect_uri` deve ser **idêntico** ao cadastrado no portal: monte com `new URL(request.url).origin`.

## Checagem antes de entregar
- `npx wrangler d1 migrations apply DB --local` sem erro.
- `npx wrangler pages dev` sobe e `GET /api/status` responde `200`.
- Cada rota do contrato existe e devolve os códigos de erro especificados.
