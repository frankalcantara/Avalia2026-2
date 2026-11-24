---
name: serverless-d1-discord
description: Implementa Cloudflare Pages Functions com Cloudflare D1 e login Discord OAuth2, com todas as regras de negócio validadas no servidor. Usar ao criar ou alterar qualquer arquivo em functions/ ou migrations/.
---

# Skill: Backend Serverless (Pages Functions + D1 + Discord OAuth2)

Usada pelo **Agente 1 (Backend)**. Contrato obrigatório: `docs/SPEC.md`.

## Estrutura de arquivos

```
functions/
  _lib/http.js          respostas JSON, erros padronizados, leitura de corpo, checagem de Origin
  _lib/session.js       cookies, criação/leitura/remoção de sessão (hash SHA-256 no D1)
  _lib/polls.js         validação de entrada e montagem de resultados (funções puras, testáveis)
  api/auth/discord.js            GET  inicia OAuth2
  api/auth/discord/callback.js   GET  troca code, upsert do usuário, cria sessão
  api/auth/logout.js             POST
  api/me.js                      GET
  api/status.js                  GET  diagnóstico público
  api/polls/index.js             GET lista / POST cria
  api/polls/[id]/index.js        GET detalhe
  api/polls/[id]/vote.js         POST voto
```

Arquivos em `_lib/` não exportam `onRequest*`, então não viram rotas.

## Regras obrigatórias

1. **Nunca confiar no cliente.** `user_id` sai da sessão, nunca do corpo. Prazo é comparado com `Date.now()` do servidor.
2. **SQL sempre parametrizado:** `env.DB.prepare("... ?").bind(v)`. Proibido montar SQL com template string contendo dados.
3. **Sessão:** token `crypto.getRandomValues(32 bytes)` em hex; no banco só `SHA-256(token)`; cookie `HttpOnly; Secure; SameSite=Lax; Path=/`. Sessão expirada é apagada e tratada como ausente.
4. **OAuth2 Discord:** `state` aleatório em cookie de 10 minutos, conferido no callback; `redirect_uri` derivado de `new URL(request.url).origin`; escopo apenas `identify`; o token do Discord não é guardado.
5. **Anti-CSRF nas rotas POST:** exigir JSON e, se houver `Origin`, ele deve bater com a origem da requisição.
6. **Voto atômico:** INSERT condicional ao prazo e à opção pertencer à enquete:
   ```sql
   INSERT INTO votes (poll_id, option_id, user_id)
   SELECT p.id, o.id, ? FROM polls p JOIN poll_options o ON o.poll_id = p.id
   WHERE p.id = ? AND o.id = ? AND p.closes_at > ?
   ```
   Antes dele, checar na ordem do SPEC para devolver o código HTTP correto; erro `UNIQUE constraint failed` vira `409 voto_duplicado`.
7. **Criação de enquete em lote:** `env.DB.batch([...])` para a enquete e as opções; obter o id da enquete com `INSERT ... RETURNING id` antes do lote de opções.
8. **Erros** sempre `{ ok:false, error, message }` com status correto (400, 401, 403, 404, 405, 409, 500). Exceções inesperadas: `500 erro_interno` sem vazar stack.
9. **Sem dependências npm** no runtime: só Web APIs (fetch, crypto.subtle, URL).

## Checklist de entrega

- [ ] Todas as rotas do SPEC existem e respondem 405 a métodos não suportados.
- [ ] `functions/_lib/polls.js` exporta `validatePollInput(body, now)` e `buildResults(options, counts)` puros.
- [ ] Nenhum `console.log` com token, segredo ou cookie.
