---
name: discord-oauth2
description: Fluxo OAuth2 Authorization Code do Discord (scope identify) com state anti-CSRF e sessão por cookie, para rodar em Cloudflare Functions.
---

# Discord OAuth2 (Authorization Code, scope `identify`)

## Passos
1. **Login**: gerar `state` aleatório (16+ bytes), guardar em cookie `oauth_state` e redirecionar para
   `https://discord.com/oauth2/authorize?client_id=...&redirect_uri=...&response_type=code&scope=identify&state=...&prompt=none`.
2. **Callback**: comparar `state` da query com o cookie (comparação em tempo constante). Divergiu: abortar.
3. **Troca do código**: `POST https://discord.com/api/oauth2/token` com `application/x-www-form-urlencoded`:
   `client_id`, `client_secret`, `grant_type=authorization_code`, `code`, `redirect_uri` (idêntico ao do passo 1).
4. **Perfil**: `GET https://discord.com/api/users/@me` com `Authorization: Bearer <access_token>`.
   Campos usados: `id`, `username`, `global_name`, `avatar`.
5. **Sessão própria**: não guardar o `access_token`. Criar token aleatório de 32 bytes, gravar só o SHA-256 no D1 e enviar o token no cookie `sid`.

## Avatar
- Com `avatar`: `https://cdn.discordapp.com/avatars/{id}/{avatar}.png?size=128`.
- Sem `avatar`: `https://cdn.discordapp.com/embed/avatars/{(BigInt(id) >> 22n) % 6n}.png`.

## Cuidados
- `client_secret` só em variável secreta da Cloudflare (`wrangler pages secret put`) ou `.dev.vars` local.
- O redirect cadastrado no portal do Discord tem de ser exatamente o `redirect_uri` usado.
- Nenhuma tela do site funciona como "login por senha"; o Discord é o único caminho.
- Falhas viram redirecionamento para `/?erro=<codigo>`; nunca mostrar a resposta crua do Discord.
