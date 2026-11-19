---
name: serverless-d1-discord
description: Construir backend serverless em Cloudflare Pages Functions com persistência no D1 e login Discord OAuth2 (escopo identify), com validação de regras de negócio no servidor. Use ao criar ou alterar functions/, lib/, migrations/ ou wrangler.jsonc.
---

# Skill: Pages Functions + D1 + Discord OAuth2

## Quando usar
Qualquer mudança em `functions/**`, `lib/**`, `migrations/**` ou `wrangler.jsonc`.

## Roteamento (Pages Functions)
- O caminho do arquivo define a rota: `functions/api/habits/[id]/completions.js` → `/api/habits/:id/completions`.
- Exporte apenas handlers `onRequestGet/Post/Put/Delete` nos arquivos de rota. Lógica reutilizável fica em `lib/`.
- Importe `lib/` por caminho relativo; o bundler do Wrangler inclui o código.
- Contexto do handler: `{ request, env, params }`. Bindings e segredos ficam em `env` (`env.DB`, `env.SESSION_SECRET`, …).

## D1
- Sempre `env.DB.prepare(sql).bind(...)` — nunca concatene entrada do usuário no SQL.
- `first()` → 1 linha ou `null`; `all()` → `{ results }`; `run()` → `{ meta: { last_row_id, changes } }`.
- Operações dependentes (ex.: apagar conclusões + hábito) vão em `env.DB.batch([...])`.
- Esquema só muda por **nova migration** numerada em `migrations/` (`0002_*.sql`); nunca edite uma migration já aplicada.
- Restrições no esquema (PK composta, `CHECK`, índice único) são a última linha de defesa; a validação principal é no código.

## Regras de negócio no servidor (nunca confie no cliente)
1. Autenticação: cookie `session` assinado com HMAC-SHA256 (`lib/session.js`); usuário recarregado do D1 a cada requisição.
2. Autorização: todo acesso a hábito filtra por `user_id` do dono; hábito alheio responde **404** (não revela existência).
3. Validação de entrada: tipos, tamanhos (nome 1–60), cor `#RRGGBB`, data ISO real, `done` booleano, limite de 30 hábitos, nome único por usuário.
4. Datas futuras são rejeitadas usando o "hoje" do servidor no fuso `APP_TZ`.
5. Métricas (streak atual, streak máximo, taxa mensal) são calculadas no servidor em `lib/stats.js` e devolvidas prontas.
6. Mutações exigem `Origin` igual à origem da requisição (defesa contra CSRF) e `Content-Type: application/json`.

## Discord OAuth2 (authorization code, escopo `identify`)
1. `GET /api/auth/discord`: gera `state` aleatório, guarda em cookie HttpOnly (10 min) e redireciona para `https://discord.com/oauth2/authorize`.
2. `GET /api/auth/discord/callback`: compara `state` da URL com o cookie; troca `code` por token em `POST https://discord.com/api/oauth2/token` (form-urlencoded); lê `GET https://discord.com/api/users/@me`; faz upsert de `id`, `username`, `global_name`, `avatar` em `users`; emite cookie de sessão.
3. `redirect_uri` = `${origin}/api/auth/discord/callback` e deve estar cadastrada **idêntica** no Discord Developer Portal.
4. Avatar: `https://cdn.discordapp.com/avatars/{id}/{hash}.png`; sem hash, usar `embed/avatars/{(id >> 22) % 6}.png`.
5. Segredos (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`) só em variáveis/segredos do Cloudflare ou `.dev.vars` — nunca no repositório.

## Formato de erro
`{ "error": { "code": "invalid_date", "message": "Data inválida. Use YYYY-MM-DD." } }` com o status HTTP correto (400/401/403/404/409/413/415).

## Checklist antes de entregar
- [ ] Nenhuma query com entrada do usuário concatenada.
- [ ] Toda rota de hábito checa dono.
- [ ] Toda mutação valida origem + corpo.
- [ ] Nenhum segredo em arquivo versionado.
- [ ] `npm test` passa.
