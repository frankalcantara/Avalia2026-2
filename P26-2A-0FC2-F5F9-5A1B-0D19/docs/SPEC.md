# Especificação Técnica: Sistema de Enquetes e Votação Verificada

Projeto #26 · Chave `P26-2A-0FC2-F5F9-5A1B-0D19` · Vinicius Kichel Derganho (2A)

Este documento é o **contrato compartilhado** entre os agentes. O Agente Backend implementa exatamente estas rotas; o Agente Frontend consome exatamente estes formatos; o Agente de Teste verifica cada regra listada aqui.

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Cliente | HTML5, CSS3, JavaScript puro (ES modules, sem frameworks, sem build) |
| Servidor | Cloudflare Pages Functions (`functions/`) |
| Banco | Cloudflare D1 (binding `DB`), migrações em `migrations/` |
| Login | Discord OAuth2, escopo `identify` |
| Variáveis | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` |

## 2. Modelo de dados (D1)

- `users(user_id TEXT PK, username, avatar_url, created_at, updated_at)`: `user_id` é o snowflake do Discord.
- `sessions(token_hash TEXT PK, user_id FK, created_at, expires_at INTEGER)`: só o **SHA-256** do token fica no banco.
- `polls(id INTEGER PK, creator_id FK, title, description, closes_at INTEGER (epoch ms UTC), created_at)`
- `poll_options(id INTEGER PK, poll_id FK, label, position)`
- `votes(id INTEGER PK, poll_id FK, option_id FK, user_id FK, created_at, UNIQUE(poll_id, user_id))`

A restrição `UNIQUE(poll_id, user_id)` é a garantia final contra voto duplo, inclusive em requisições simultâneas.

## 3. Sessão e segurança

- Cookie `sessao`: token aleatório de 32 bytes (hex), `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800` (7 dias).
- Cookie `oauth_state`: valor aleatório gerado em `/api/auth/discord`, conferido no callback (anti-CSRF do OAuth). `Max-Age=600`.
- Toda rota `POST` exige `Content-Type: application/json` e, quando o cabeçalho `Origin` existir, ele deve ser igual à origem da requisição (senão `403`).
- Todo SQL usa `prepare().bind()`.
- O cliente **nunca** envia `user_id`: a identidade vem sempre da sessão.

## 4. Rotas

Erros sempre no formato `{ "ok": false, "error": "codigo", "message": "texto em português" }`.

### Autenticação

| Método e rota | Comportamento |
|---|---|
| `GET /api/auth/discord` | Gera `state`, grava cookie `oauth_state`, redireciona (302) para `https://discord.com/oauth2/authorize` com `response_type=code`, `scope=identify`, `redirect_uri=<origem>/api/auth/discord/callback`. Sem `DISCORD_CLIENT_ID`: 500 `oauth_not_configured`. |
| `GET /api/auth/discord/callback` | Confere `state`; troca `code` em `https://discord.com/api/oauth2/token`; lê `https://discord.com/api/users/@me`; faz upsert em `users` (user_id, nome = `global_name` ou `username`, avatar); cria sessão; redireciona para `/`. Em erro redireciona para `/?erro=<codigo>`. |
| `POST /api/auth/logout` | Apaga a sessão no D1 e expira o cookie. `200 {ok:true}`. |
| `GET /api/me` | `200 {ok:true, user:{user_id, username, avatar_url}}` ou `401 nao_autenticado`. |

URL do avatar: `https://cdn.discordapp.com/avatars/<id>/<hash>.png?size=128`; sem avatar: `https://cdn.discordapp.com/embed/avatars/<(BigInt(id) >> 22n) % 6n>.png`.

### Enquetes (todas exigem sessão; sem sessão: `401 nao_autenticado`)

**`GET /api/polls`**: lista todas, ordem: abertas primeiro (prazo mais próximo), depois encerradas (mais recentes).
```json
{ "ok": true, "server_now": 1795600000000, "polls": [
  { "id": 1, "title": "...", "description": "...", "closes_at": 1795700000000, "is_open": true,
    "total_votes": 3, "has_voted": false, "option_count": 4,
    "creator": { "username": "...", "avatar_url": "..." } } ] }
```

**`POST /api/polls`**: corpo `{ "title", "description", "closes_at": "<ISO 8601>", "options": ["A","B"] }`.
Validações no servidor:
- `title`: texto, 3 a 120 caracteres após `trim`.
- `description`: texto, 0 a 1000 caracteres.
- `closes_at`: data válida, no mínimo 5 minutos no futuro e no máximo 365 dias.
- `options`: array de 2 a 10 itens, cada um 1 a 100 caracteres após `trim`, sem repetição (comparação sem diferenciar maiúsculas).
Resposta `201 { ok:true, poll:{ id, ... } }` ou `400 dados_invalidos` com `message` explicando o campo.

**`GET /api/polls/:id`**:
```json
{ "ok": true, "server_now": 0, "poll": { "id": 1, "title": "", "description": "", "closes_at": 0,
  "is_open": true, "has_voted": false, "my_option_id": null, "total_votes": 0,
  "creator": { "username": "", "avatar_url": "" },
  "options": [ { "id": 10, "label": "A" } ],
  "results": null } }
```
`results` só é preenchido quando `has_voted` ou `!is_open` (o resultado parcial não influencia quem ainda vai votar):
`"results": { "total_votes": 5, "options": [ { "id": 10, "label": "A", "votes": 3, "percent": 60.0 } ] }`.
Percentual com 1 casa decimal; `0` quando não há votos. `404 enquete_nao_encontrada` se não existir.

**`POST /api/polls/:id/vote`**: corpo `{ "option_id": 10 }`. Ordem de verificação:
1. sessão → `401 nao_autenticado`
2. enquete existe → `404 enquete_nao_encontrada`
3. prazo: `Date.now() >= closes_at` → `403 enquete_encerrada`
4. opção pertence à enquete → `400 opcao_invalida`
5. já votou → `409 voto_duplicado`
Sucesso: `201 { ok:true, results:{...} , my_option_id }`. O INSERT é condicional ao prazo e a violação de `UNIQUE` também vira `409` (cobre corrida entre duas abas).

### Diagnóstico

`GET /api/status` (público): `{ ok, chave, d1Connected, discordOAuthConfigured, serverTimestamp }`.

## 5. Interface (rotas por hash)

| Hash | Tela |
|---|---|
| (sem sessão) | Tela de boas-vindas com botão "Entrar com Discord" |
| `#/` | Lista de enquetes em cards (status aberta/encerrada, prazo, total de votos, se já votei) |
| `#/nova` | Formulário: título, descrição, prazo (`datetime-local`), opções dinâmicas (adicionar/remover, 2 a 10) |
| `#/enquete/:id` | Detalhe: opções em radio + botão Votar; após votar ou com prazo vencido, **barras horizontais proporcionais** com % e votos, destaque na opção escolhida |

Cabeçalho mostra avatar e nome do Discord e botão Sair. Rodapé (`<footer>`) mostra a chave `P26-2A-0FC2-F5F9-5A1B-0D19`.
