# Contrato da API (fonte única para os agentes)

Projeto #32: Gerenciador de Eventos e Controle de Presença (RSVP)
Chave: `P26-3A-DAD6-042E-642E-9A58`

Tudo roda num único projeto Cloudflare Pages: `public/` é o site estático e
`functions/` são as Pages Functions na mesma origem. O banco é o D1 com binding
`DB` e o esquema em `migrations/0001_init.sql`.

## Variáveis do ambiente (painel do Pages)

| Nome | Tipo | Uso |
|---|---|---|
| `DISCORD_CLIENT_ID` | variável | Client ID da aplicação Discord |
| `DISCORD_CLIENT_SECRET` | segredo | Client Secret da aplicação Discord |
| `PUBLIC_BASE_URL` | variável | ex.: `https://eventos-rsvp-gabriel.pages.dev` (sem barra no fim) |
| `DB` | binding D1 | banco do projeto |

Redirect cadastrado no Discord: `${PUBLIC_BASE_URL}/api/auth/discord/callback`.

## Regras gerais

- Toda resposta das Functions tem `Cache-Control: no-store`; JSON em UTF-8.
- Erros sempre no formato `{ "error": "<codigo>", "message": "<texto em pt-BR>" }`.
- Sessão: cookie `__Host-session` (opaco, 32 bytes Base64URL, `HttpOnly; Secure;
  SameSite=Lax; Path=/`, 8 h). O D1 guarda só o SHA-256 dele.
- Requisições que mudam estado (`POST`, `DELETE`) exigem cabeçalho `Origin`
  igual a `PUBLIC_BASE_URL` (senão `403 invalid_origin`) e sessão válida
  (senão `401 unauthenticated`).
- O servidor nunca confia no cliente: valida tipos, tamanhos, datas e capacidade
  e decide sozinho se a inscrição é confirmada ou vai para a fila.

## Rotas

### Autenticação (Discord OAuth2, escopo `identify`)

| Método | Caminho | Resposta |
|---|---|---|
| GET | `/api/auth/discord` | 302 para `https://discord.com/oauth2/authorize` com `state` aleatório; grava cookie `__Host-oauth-tx` (10 min) e o resumo em `oauth_states`. Aceita `?next=/#/evento/12` (só caminhos relativos começando com `/`; guardar junto à transação não é obrigatório: pode ir num cookie `__Host-oauth-next`). |
| GET | `/api/auth/discord/callback` | Confere cookie + `state` (uso único, apaga a linha), troca o `code` em `https://discord.com/api/oauth2/token`, lê `GET https://discord.com/api/users/@me`, faz upsert em `discord_users`, revoga o access token (`/api/oauth2/token/revoke`, falha na revogação não bloqueia), cria sessão e redireciona 302 para `next` ou `/`. Em erro redireciona para `/?erro=<codigo>`. |
| POST | `/api/auth/logout` | Apaga a sessão e expira o cookie. `204`. |
| GET | `/api/me` | `200 { user_id, username, global_name, avatar_url }` ou `401 { error: "unauthenticated" }`. |

`avatar_url`: `https://cdn.discordapp.com/avatars/{user_id}/{avatar}.png?size=128`
ou, sem avatar, `https://cdn.discordapp.com/embed/avatars/{(BigInt(user_id) >> 22n) % 6n}.png`.

### Eventos

Objeto **EventSummary**:
```json
{
  "id": 12, "title": "Grupo de estudo de SQL", "description": "…" ,
  "location": "Bloco B, sala 204", "date": "2026-11-27", "time": "19:00",
  "capacity": 30, "confirmed_count": 30, "waitlist_count": 4,
  "spots_left": 0,
  "creator": { "user_id": "…", "username": "…", "avatar_url": "…" },
  "my_status": "confirmed" | "waitlist" | null,
  "my_position": 3 | null,
  "is_creator": true | false
}
```
`my_status`, `my_position` e `is_creator` dependem da sessão (sem sessão: `null`/`false`).
`my_position` é a posição 1-based na fila (só quando `my_status = "waitlist"`).

| Método | Caminho | Resposta |
|---|---|---|
| GET | `/api/events` | `200 { events: EventSummary[] }`. Por padrão só eventos de hoje em diante (fuso `America/Sao_Paulo`), ordenados por data e hora. `?scope=all` traz também os passados; `?scope=mine` traz os que criei ou em que estou inscrito (exige sessão). |
| POST | `/api/events` | Corpo `{ title, description?, location, date, time, capacity }`. Validação: título 3–120, local 2–120, descrição ≤ 2000, `date` AAAA-MM-DD válido e não anterior a hoje, `time` HH:MM, `capacity` inteiro 1–10000. `201 { event: EventSummary }` ou `400 { error: "validation", message, fields: { campo: "motivo" } }`. |
| GET | `/api/events/:id` | `200 { event: EventSummary, confirmed: Attendee[], waitlist: Attendee[] }`. `Attendee = { user_id, username, avatar_url, requested_at, position? }`. Fila ordenada por `requested_at, id`, com `position` 1-based. `404 not_found` se não existir. |
| DELETE | `/api/events/:id` | Só o criador. `204`; `403 forbidden` para outros; `404`. |
| POST | `/api/events/:id/rsvp` | Inscreve o usuário da sessão. O backend conta os confirmados no D1 e decide: vaga livre → `confirmed`; lotado → `waitlist`. A decisão e a inserção acontecem numa única instrução SQL (atômica). Já inscrito → `409 already_registered`. Evento passado → `409 event_closed`. Resposta `201 { status, position, event: EventSummary }`. |
| DELETE | `/api/events/:id/rsvp` | Cancela a inscrição do usuário da sessão. Se ele estava confirmado, o primeiro da fila (menor `requested_at`, depois menor `id`) vira `confirmed` e ganha `promoted_at`, na mesma transação (`DB.batch`). `200 { cancelled: true, promoted_user_id: "…" | null, event: EventSummary }`; `404 not_registered`. |

## Regra da fila (núcleo do projeto)

1. Inscrição: `INSERT … SELECT … CASE WHEN confirmados < capacidade THEN 'confirmed' ELSE 'waitlist' END`.
2. Cancelamento: em um `DB.batch([...])` (transação):
   `DELETE` da inscrição e depois
   `UPDATE registrations SET status='confirmed', promoted_at=?
    WHERE id = (SELECT id FROM registrations WHERE event_id=? AND status='waitlist' ORDER BY requested_at, id LIMIT 1)
      AND (SELECT COUNT(*) FROM registrations WHERE event_id=? AND status='confirmed') < (SELECT capacity FROM events WHERE id=?)`.
   A condição de capacidade faz o cancelamento de quem estava na fila não promover ninguém.
3. Invariante: `confirmados ≤ capacidade` sempre; ninguém fica na fila se houver vaga.

## Front-end

`public/index.html`, `public/styles.css` e `public/app.js` em HTML5, CSS3 e
JavaScript puro, sem frameworks nem bibliotecas de UI. Roteamento por hash:
`#/` (lista), `#/novo` (criar evento, exige login), `#/evento/:id` (detalhe).
O `<footer>` mostra a chave `P26-3A-DAD6-042E-642E-9A58`.
