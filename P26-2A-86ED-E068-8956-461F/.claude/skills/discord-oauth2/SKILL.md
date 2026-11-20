---
name: discord-oauth2
description: Fluxo Authorization Code do Discord OAuth2 em Cloudflare Pages Functions, com state anti-CSRF e sessão em cookie HttpOnly.
---

# Login com Discord (OAuth2)

## Fluxo
1. `/api/auth/login`: gera `state` aleatório, grava em cookie HttpOnly de 10 minutos e redireciona para `https://discord.com/oauth2/authorize` com `client_id`, `redirect_uri`, `response_type=code`, `scope=identify` e `state`.
2. `/api/auth/callback`: confere `state` com o cookie; troca `code` por token em `POST https://discord.com/api/oauth2/token` (form-urlencoded); lê `GET https://discord.com/api/users/@me`.
3. Grava/atualiza o usuário no D1 com `id`, `username`, nome de exibição (`global_name`) e URL do avatar.
4. Cria sessão: token aleatório no cookie (`HttpOnly; Secure; SameSite=Lax`), apenas o hash SHA-256 no banco.

## Regras
- O `redirect_uri` é montado com `new URL(request.url).origin` e precisa ser idêntico ao cadastrado no Portal do Discord (`https://DOMINIO/api/auth/callback`).
- O client secret fica em variável de ambiente (secret) do Cloudflare. Nunca no repositório.
- Escopo mínimo: `identify`.
- Avatar ausente: usar avatar padrão do Discord calculado a partir do id.
- Enviar `User-Agent` nas chamadas à API do Discord.
- POSTs da API conferem o cabeçalho `Origin` (defesa extra contra CSRF).
