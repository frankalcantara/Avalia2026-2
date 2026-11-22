---
name: serverless-d1-discord
description: Regras para escrever Cloudflare Pages Functions com persistência no D1 e login OAuth2 do Discord neste projeto (Memorize). Use ao criar ou alterar qualquer arquivo em functions/ ou migrations/.
---

# Skill · Serverless + D1 + Discord OAuth2

## Estrutura
- Rotas em `functions/api/**` (roteamento por arquivo do Cloudflare Pages). Parâmetros dinâmicos com `[id].js`.
- Código compartilhado em `functions/_lib/*.js`. Esses arquivos **não** exportam `onRequest*`, então não viram rotas.
- Nunca importar de um arquivo de rota; tudo o que é reutilizado vai para `_lib`.
- Esquema do banco só em `migrations/NNNN_nome.sql`. Nada de `CREATE TABLE` em tempo de requisição.

## Autenticação (Discord OAuth2, Authorization Code)
1. `GET /api/auth/discord`: gera `state` aleatório (`randomToken`), grava em cookie `oauth_state` (HttpOnly, Secure, SameSite=Lax, Path=/api/auth, 10 min) e redireciona para `https://discord.com/oauth2/authorize` com `scope=identify`.
2. `GET /api/auth/discord/callback`: compara `state` com o cookie usando `safeEqual`, troca o `code` em `https://discord.com/api/oauth2/token`, lê `https://discord.com/api/users/@me` e faz *upsert* de `id`, `username`, `global_name`, `avatar` em `users`.
3. A sessão é um token aleatório de 32 bytes no cookie `sid`; no D1 fica **somente o SHA-256** (`sessions.token_hash`) com `expires_at`.
4. Segredos (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`) vêm de `env`, nunca do código.

## Regras de segurança obrigatórias
- O `_middleware.js` de `/api` carrega `context.data.user`; **nenhuma rota confia em user_id vindo do cliente**.
- Toda consulta a `decks`/`cards`/`reviews` filtra por `user_id = ?` (dono do recurso).
- Sempre usar `prepare(...).bind(...)`; nunca interpolar valores do usuário em SQL.
- Entradas passam por `functions/_lib/validate.js` (tamanho, tipo, campos obrigatórios).
- Escritas (POST/PUT/DELETE) de outra origem são bloqueadas com 403 (verificação de `Origin`/`Sec-Fetch-Site`).
- Erros são lançados como `HttpError(status, mensagem, código)` e o middleware converte em JSON.

## Regra de negócio: revisão
- `POST /api/review` só aceita `rating` em `hard|good|easy`.
- O cartão precisa estar vencido (`due_date <= hoje`) ou ser novo dentro do limite de 20/dia por baralho.
- O cálculo vem de `functions/_lib/sm2.js` (ver skill `sm2-repeticao-espacada`).
- O `UPDATE` é condicional (`repetitions` e `updated_at` iguais aos lidos) para impedir avaliação dupla.
- "Hoje" é o dia local do estudante (`X-Timezone`, validado com `Intl`), padrão `America/Sao_Paulo`.

## Checklist antes de entregar
- [ ] Nova tabela/coluna tem migração numerada.
- [ ] Rota nova está protegida pelo middleware (ou está na lista `PUBLIC_ROUTES` por um motivo explícito).
- [ ] Respostas usam `json()`, com `cache-control: no-store`.
