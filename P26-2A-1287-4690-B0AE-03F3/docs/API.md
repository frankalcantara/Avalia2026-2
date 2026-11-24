# Contrato da API — Kudos Board

Todos os endpoints vivem em `functions/api/**` (Cloudflare Pages Functions) e usam o binding D1 `DB`.
Respostas são JSON (`Content-Type: application/json`) exceto os redirects de OAuth.
Erros: `{ "error": "mensagem" }` com status 400/401/403/404/500.

## Variáveis de ambiente (Pages → Settings → Variables and Secrets)
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET` (secret)
- Binding D1: `DB`
- O `redirect_uri` é sempre `${origin}/api/auth/callback` (origin da requisição).

## Schema D1 (`migrations/0001_init.sql`)
```sql
users(id TEXT PK /*Discord user_id*/, username TEXT NOT NULL, avatar TEXT /*URL completa*/, created_at TEXT NOT NULL)
sessions(token_hash TEXT PK /*SHA-256 hex do token*/, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL /*epoch s*/)
oauth_states(state TEXT PK, expires_at INTEGER NOT NULL)
kudos(id INTEGER PK AUTOINCREMENT, from_user_id TEXT NOT NULL, to_user_id TEXT NOT NULL,
      badge TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL,
      CHECK (from_user_id <> to_user_id))
```
Índices em `kudos(to_user_id)`, `kudos(from_user_id)`, `kudos(created_at)`.

## Sessão
Cookie `kb_session` (HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800) com token aleatório (32 bytes hex).
No banco guarda-se apenas o SHA-256 do token. Em `http://localhost` o atributo `Secure` é omitido.

## Selos válidos (`functions/_lib/badges.js`, fonte única da verdade)
| id | rótulo | emoji |
|---|---|---|
| `bug-critico` | Resolveu um Bug Crítico | 🐛 |
| `otima-explicacao` | Ótima Explicação | 💡 |
| `ajuda-projeto` | Ajuda no Projeto | 🤝 |
| `code-review` | Code Review Excelente | 🔍 |
| `trabalho-equipe` | Espírito de Equipe | 🚀 |
| `mentoria` | Mentoria | 🎓 |

## Endpoints
### `GET /api/auth/login`
Cria `state` aleatório (tabela `oauth_states`, TTL 10 min) e responde 302 para
`https://discord.com/oauth2/authorize?client_id=…&response_type=code&redirect_uri=…&scope=identify&state=…`.

### `GET /api/auth/callback?code&state`
Valida e consome o `state` (uso único, não expirado). Troca o code por token em
`https://discord.com/api/oauth2/token`, busca `https://discord.com/api/users/@me`, faz upsert em `users`
(`id`, `username` = `global_name || username`, `avatar` = `https://cdn.discordapp.com/avatars/{id}/{hash}.png?size=128`
ou avatar padrão `https://cdn.discordapp.com/embed/avatars/{(id>>22)%6}.png`), cria sessão, seta cookie e responde 302 para `/`.
Falha → 302 para `/?erro=login`.

### `POST /api/auth/logout`
Apaga a sessão e o cookie. `{ "ok": true }`.

### `GET /api/me`
`200 { "user": { id, username, avatar } }` ou `401 { "error": "Não autenticado" }`.

### `GET /api/users` (autenticado)
`{ "users": [ { id, username, avatar } ] }` ordenado por username, **excluindo o usuário logado**.

### `GET /api/badges`
`{ "badges": [ { id, label, emoji } ] }` (público).

### `GET /api/kudos` (público para leitura)
Query: `filter` = `all` (padrão) | `received` | `sent`; `user` = id Discord (obrigatório se filter≠all);
`limit` (1–100, padrão 50); `before` (id, paginação por cursor).
Resposta: `{ "kudos": [ { id, badge, badge_label, badge_emoji, message, created_at,
 from: {id, username, avatar}, to: {id, username, avatar} } ] }` mais recentes primeiro.

### `POST /api/kudos` (autenticado)
Body JSON `{ to_user_id, badge, message }`. Regras **no servidor**:
1. 401 se sem sessão.
2. 400 se JSON inválido / campos ausentes.
3. 400 se `badge` não está na lista.
4. 400 se `message` (trim) vazia ou > 280 caracteres.
5. **400 se `to_user_id === id da sessão`** (nunca enviar elogio a si mesmo; o remetente vem SEMPRE da sessão, nunca do body).
6. 404 se destinatário não existe em `users`.
7. Rate limit simples: 403/429 não requerido.
Sucesso: `201 { "kudo": {…mesmo formato do GET…} }`. A mensagem é guardada como texto puro (o cliente escapa ao renderizar).

## Frontend (`public/`)
`index.html`, `css/style.css`, `js/app.js` (ES modules opcionais), Vanilla JS, sem frameworks.
Rodapé deve conter a chave `P26-2A-1287-4690-B0AE-03F3`. Grade com CSS Grid/Masonry (colunas CSS),
responsiva, filtros (Todos / Recebidos / Enviados + seletor de perfil), formulário de envio, login/logout Discord.
Renderização usando `textContent`/`createElement` (nunca `innerHTML` com dados do usuário).
