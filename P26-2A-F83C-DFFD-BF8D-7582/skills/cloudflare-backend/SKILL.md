---
name: cloudflare-backend
description: Engenharia de backend para Cloudflare Pages Functions + D1 + Discord OAuth2 no Projeto #14. Use ao criar ou revisar rotas em functions/api, schema/migrations D1, sessão HMAC, OAuth2, validação de payload, filtros e contratos JSON.
---

# Skill: Backend Serverless — Cloudflare Pages Functions + D1 + Discord OAuth2

**Projeto:** #14 — Diário de Bordo de Projetos
**Pasta:** `P26-2A-F83C-DFFD-BF8D-7582/`

## Quando ativar

- Criar ou alterar qualquer rota em `functions/api/**`.
- Mexer no schema D1 (`migrations/`, `schema.sql`) ou em queries.
- Revisar sessão, OAuth2, cookies, validação de entrada e contratos JSON.
- Investigar 401/400/500 em produção.

## Mapa de rotas (contrato oficial)

| Rota | Método | Auth | Resposta |
|------|--------|------|----------|
| `/api/auth/login` | GET | pública | `302` para `discord.com/api/oauth2/authorize` com `state` |
| `/api/auth/discord` | GET | pública | `302` para `/api/auth/login` (alias oficial) |
| `/api/auth/callback` | GET | pública | `302` para `/` ou `/?auth_error=<motivo>` |
| `/api/auth/discord/callback` | GET | pública | `302` para `/api/auth/callback` preservando `code`/`state` |
| `/api/auth/me` | GET | sessão | `200 {user_id, username, avatar}` ou `401 {error}` |
| `/api/auth/me?logout=1` | GET | pública | `200 {success:true}` + cookie expirado (ou `302 /` se `Accept: text/html`) |
| `/api/logs` | POST | sessão | `201 {success, id, criado_em}` |
| `/api/logs` | GET | sessão | `200 [registros]` |

## Regras não negociáveis

1. **Somente Pages Functions.** Nada de Workers separados, Express, Hono ou servidor Node. Handlers exportam `onRequestGet`/`onRequestPost` e recebem `{ request, env }`.
2. **D1 com prepared statements.** Todo acesso usa `env.DB.prepare(sql).bind(...).run()/all()`. Nunca interpolar valores do usuário na string SQL.
3. **Discord OAuth2 é o único login.** `scope=identify`; capturar `id`, `username` e `avatar`. Nunca criar login local, e-mail/senha ou sessão anônima.
4. **`state` anti-CSRF obrigatório.** Gerar `crypto.randomUUID()` no login, guardar em cookie `oauth_state` (10 min) e comparar no callback antes de trocar o `code`.
5. **Sessão assinada com HMAC-SHA256.** Payload `{user_id, username, avatar, iat, exp}` em Base64URL + assinatura, via `crypto.subtle` (`lib/session.js`). Cookie `session` com `HttpOnly`, `Path=/`, `SameSite=Lax` e `Secure` em HTTPS. TTL padrão: 86400 s.
6. **Segredo nunca no cliente.** `getSessionSecret(env)` usa `SESSION_SECRET` e, como fallback, `DISCORD_CLIENT_SECRET`. Segredos ficam em secrets do Cloudflare, nunca no repositório.
7. **`criado_em` é gerado exclusivamente no servidor.** Ignorar qualquer data enviada no corpo. Usar `new Date().toISOString()` imediatamente antes do `INSERT`.
8. **Isolamento por usuário.** Toda leitura começa com `WHERE user_id = ?` usando o `user_id` da sessão. Nunca aceitar `user_id` de query/body.
9. **Erros genéricos ao cliente, detalhes no log.** `500 {error:"Erro interno do servidor"}` + `console.error`; nunca devolver stack trace, SQL ou segredo.
10. **Status HTTP corretos.** Não devolver `200` com `{error}`. Validação `400`, não autenticado `401`, banco ausente `503`, falha interna `500`, criação `201`.

## Contratos JSON

### `POST /api/logs`

Requisição:

```json
{ "conteudo": "Implementei a timeline", "impedimento": "sem" }
```

Validações, nesta ordem:

| Condição | Status | Corpo |
|----------|--------|-------|
| JSON inválido | 400 | `{"error":"Corpo da requisição inválido"}` |
| `conteudo` ou `impedimento` ausente/vazio | 400 | `{"error":"Campos obrigatórios: conteudo, impedimento"}` |
| `conteudo` > 2000 caracteres | 400 | `{"error":"O conteúdo deve ter no máximo 2000 caracteres"}` |
| `impedimento` fora de `sem/atencao/bloqueado` | 400 | `{"error":"Valor de impedimento inválido. Use: sem, atencao ou bloqueado"}` |
| Sem sessão válida | 401 | `{"error":"Não autenticado"}` |
| `env.DB` ausente | 503 | `{"error":"Banco de dados D1 não configurado"}` |

Sucesso `201`:

```json
{ "success": true, "id": 42, "criado_em": "2026-11-14T20:43:15.712Z" }
```

### `GET /api/logs`

Query params opcionais, todos combináveis:

- `busca`: trecho de conteúdo (`LIKE %busca%`).
- `impedimento`: `sem` | `atencao` | `bloqueado`.
- `inicio`: `YYYY-MM-DD` → compara com `${inicio}T00:00:00.000Z`.
- `fim`: `YYYY-MM-DD` → compara com `${fim}T23:59:59.999Z` (dia inteiro incluído).

Ordenação obrigatória: `ORDER BY criado_em DESC, id DESC`.

Resposta `200`: array de `{id, user_id, username, avatar, conteudo, impedimento, criado_em}`.
Datas inválidas ou impedimento inválido: `400`.

## Padrões de implementação

### Handler e resposta JSON

```js
function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet({ request, env }) {
  const session = await authenticateRequest(request, env);
  if (!session) return jsonResponse({ error: 'Não autenticado' }, 401);
  // ...
}
```

### Query parametrizada com filtros incrementais

```js
let query = 'SELECT id, user_id, username, avatar, conteudo, impedimento, criado_em FROM logs WHERE user_id = ?';
const params = [session.user_id];

if (busca) { query += ' AND conteudo LIKE ?'; params.push(`%${busca}%`); }
if (impedimento) { query += ' AND impedimento = ?'; params.push(impedimento); }
if (inicio) { query += ' AND criado_em >= ?'; params.push(`${inicio}T00:00:00.000Z`); }
if (fim) { query += ' AND criado_em <= ?'; params.push(`${fim}T23:59:59.999Z`); }

query += ' ORDER BY criado_em DESC, id DESC';
const { results } = await env.DB.prepare(query).bind(...params).all();
```

### Sessão

- Assinar: `signSession({ user_id, username, avatar }, secret, 86400)`.
- Validar: `authenticateRequest(request, env)` lê o cookie `session` e retorna o payload ou `null`.
- Logout: `buildCookie('session', '', { maxAge: 0, isHttps })`.
- Em HTTPS, `Secure` é adicionado automaticamente.

### OAuth2

1. `/api/auth/login`: gerar `state`, montar URL de autorização com `client_id`, `redirect_uri`, `response_type=code`, `scope=identify` e gravar cookie `oauth_state`.
2. `/api/auth/callback`: ler `code` e `state`; comparar com o cookie; trocar o code em `https://discord.com/api/oauth2/token`; buscar `https://discord.com/api/users/@me`; assinar a sessão; limpar `oauth_state`; redirecionar para `/`.
3. Falhas redirecionam para `/?auth_error=access_denied|invalid_state|missing_code|token_exchange_failed|fetch_user_failed|callback_exception`.

## Schema D1

```sql
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    avatar TEXT,
    conteudo TEXT NOT NULL,
    impedimento TEXT NOT NULL,
    criado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_user_criado ON logs(user_id, criado_em DESC);
```

- `migrations/0001_init.sql` é a fonte versionada; `schema.sql` é cópia de conveniência.
- Aplicar remoto: `wrangler.cmd d1 migrations apply DB --remote`.
- Nunca alterar migration já aplicada; criar `0002_*.sql`.

## Segurança — checklist rápido

- [ ] Rota protegida retorna `401` sem cookie e com cookie adulterado/expirado.
- [ ] `state` é validado e o cookie é de uso único.
- [ ] Nenhum segredo em código, README, logs ou resposta.
- [ ] Nenhum `user_id` vindo do cliente.
- [ ] Nenhuma data vinda do cliente.
- [ ] `conteudo` é `trim()` antes de validar e gravar.
- [ ] Queries 100% parametrizadas.
- [ ] Erros internos não vazam detalhes.
- [ ] `Set-Cookie` de logout tem `Max-Age=0`.

## Anti-patterns

- ❌ `SELECT * FROM logs` sem `WHERE user_id = ?`.
- ❌ `INSERT` com `criado_em` do `body`.
- ❌ `return jsonResponse({error}, 200)`.
- ❌ Concatenar `busca` na SQL.
- ❌ Guardar token do Discord no cookie ou no banco.
- ❌ Usar `localStorage` para sessão.
- ❌ Criar rota que aceita `user_id` como parâmetro.
- ❌ Esquecer `ORDER BY` (timeline fora de ordem).
- ❌ Truncar `fim` em `T00:00:00.000Z` (perde o dia inteiro).

## Comandos

```bash
node --test tests/api.test.mjs
wrangler.cmd d1 migrations apply DB --remote
wrangler.cmd pages deploy public --project-name avalia2026-2 --branch main
```

## Critérios de aceite

1. Contratos acima respeitados à risca.
2. Testes `node --test tests/api.test.mjs` verdes.
3. Nenhuma alteração fora de `P26-2A-F83C-DFFD-BF8D-7582/`.
4. Rotas antigas e aliases oficiais continuam funcionando.

