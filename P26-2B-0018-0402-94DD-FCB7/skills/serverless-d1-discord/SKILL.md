---
name: serverless-d1-discord
description: Diretrizes e padrões de engenharia para implementar o backend serverless do Projeto #30 (Jukebox e Playlists Colaborativas de Links) usando Cloudflare Pages Functions, Cloudflare D1 e Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Escopo de Aplicação
Esta skill orienta o **Agente 1 (Arquiteto Serverless, D1 e Discord OAuth2)** no desenvolvimento das camadas de dados, autenticação e regras de negócio na borda da subpasta `P26-2B-0018-0402-94DD-FCB7/`.

## Regras Obrigatórias de Arquitetura

1. **Validação Estrita na Borda (Zero Confiança no Cliente):**
   - Toda operação de escrita (`POST`, `DELETE`) em salas, faixas e votos deve exigir sessão autenticada verificada no servidor.
   - Retornar `401 Unauthorized` para requisições sem sessão válida, `403 Forbidden` para violações de autoria/permissão, `400 Bad Request` para payloads malformados e `409 Conflict` para duplicidades (ex.: mesma faixa já cadastrada na sala).
   - Nunca aceitar `user_id` ou `username` vindos do corpo da requisição como fonte de identidade: derivar sempre o usuário a partir da sessão autenticada no banco D1.

2. **Autenticação Exclusiva via Discord OAuth2:**
   - Implementar `/api/auth/discord` gerando token CSRF `state` criptograficamente seguro em cookie `HttpOnly` e redirecionando para `https://discord.com/api/oauth2/authorize` com `scope=identify`.
   - Implementar `/api/auth/discord/callback` validando o `state`, trocando o `code` em `https://discord.com/api/oauth2/token`, consultando `https://discord.com/api/users/@me` para importar `user_id`, `username` (`global_name || username`) e `avatar` (URL CDN do Discord).
   - Persistir usuário na tabela `discord_users` e criar sessão opaca com token aleatório (`crypto.getRandomValues`) na tabela `sessions` com expiração, gravando cookie `HttpOnly; SameSite=Lax; Path=/` (e `Secure` em HTTPS).
   - Implementar `/api/auth/me` (`GET`) e `/api/auth/logout` (`POST`).

3. **Modelagem Relacional e Queries Parametrizadas no Cloudflare D1:**
   - Definir esquema completo em `migrations/0001_init.sql` com chaves estrangeiras, `CHECK` constraints e índices:
     - `discord_users(user_id, username, avatar, created_at, updated_at)`
     - `sessions(token, user_id, expires_at, created_at)`
     - `rooms(id, slug, name, description, theme_tag, created_by, created_at)`
     - `tracks(id, room_id, title, artist, genre, url, normalized_url, provider, embed_url, submitted_by, created_at)`
     - `track_votes(id, track_id, user_id, value, updated_at)` com `CHECK (value IN (-1, 1))` e `UNIQUE(track_id, user_id)`
   - Toda query SQL deve usar exclusivamente `env.DB.prepare("...").bind(...)`. Proibida interpolação direta de entradas do usuário em SQL.

4. **Validação de Links Musicais no Servidor (YouTube, Spotify e SoundCloud):**
   - Aceitar exclusivamente URLs `https://` pertencentes aos provedores permitidos:
     - **YouTube:** `youtube.com/watch?v=...`, `youtu.be/...`, `music.youtube.com/watch?v=...`, `youtube.com/shorts/...` (ID de 11 caracteres `[A-Za-z0-9_-]`), gerando `embed_url` seguro via `https://www.youtube-nocookie.com/embed/<id>`.
     - **Spotify:** `open.spotify.com/(intl-xx/)?(track|album|playlist|episode)/<id>`, gerando `embed_url` via `https://open.spotify.com/embed/<tipo>/<id>?utm_source=generator&theme=0`.
     - **SoundCloud:** `soundcloud.com/<artista>/<faixa>`, gerando `embed_url` via `https://w.soundcloud.com/player/?url=<encoded>`.
   - Rejeitar esquemas perigosos (`javascript:`, `data:`, `http:`) e domínios não autorizados.

5. **Cálculo e Ordenação de Saldo de Votos no Servidor:**
   - Calcular `score = COALESCE(SUM(value), 0)`, `upvotes`, `downvotes` e `user_vote` diretamente no D1.
   - Garantir voto único por `(track_id, user_id)`, permitindo alternância (`+1` ↔ `-1`) e remoção (`0`).
   - Retornar a fila ordenada por `score DESC, upvotes DESC, created_at ASC`.

6. **Organização Modular:**
   - Centralizar helpers compartilhados em `src/server/` (`http.js`, `db.js`, `auth.js`, `validators.js`) para evitar exposição acidental de rotas internas dentro de `functions/`.
