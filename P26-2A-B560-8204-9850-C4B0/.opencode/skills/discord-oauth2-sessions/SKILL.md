---
name: discord-oauth2-sessions
description: Implementação segura de login com Discord OAuth2 (Authorization Code Flow) e sessões assinadas com HMAC-SHA256 em Cloudflare Pages Functions.
---

# Discord OAuth2 & Sessões Stateless na Borda

## 1. Fluxo Completo de Autenticação
1. **`GET /api/auth/discord` (ou `/api/auth/login`):**
   - Gera token aleatório criptográfico `state` (`crypto.randomUUID()`).
   - Grava `oauth_state` em cookie `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`.
   - Redireciona (302) para `https://discord.com/oauth2/authorize` com `client_id`, `redirect_uri`, `response_type=code`, `scope=identify` e `state`.
2. **`GET /api/auth/discord/callback` (ou `/api/auth/callback`):**
   - Valida `code` e compara `state` da query string com o cookie `oauth_state`.
   - Faz `POST` para `https://discord.com/api/v10/oauth2/token` (`application/x-www-form-urlencoded`).
   - Faz `GET` para `https://discord.com/api/v10/users/@me` com `Authorization: Bearer <access_token>`.
   - Extrai `id` (`user_id`), `username` (`global_name || username`) e constrói URL do avatar (`https://cdn.discordapp.com/avatars/${id}/${avatar}.png` ou fallback padrão `https://cdn.discordapp.com/embed/avatars/0.png`).
   - Realiza `UPSERT` do usuário na tabela `users` do Cloudflare D1.
   - Gera token de sessão assinado via Web Crypto API (`HMAC-SHA256`) contendo `{ user_id, username, avatar, exp }`.
   - Define cookie `session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800` e redireciona para `/`.
3. **`GET /api/auth/me` & `POST /api/auth/logout`:**
   - `/me` verifica a assinatura HMAC e expiração do cookie `session`, retornando os dados do usuário autenticado (ou `401`).
   - `/logout` expira o cookie `session` com `Max-Age=0`.

## 2. Assinatura HMAC-SHA256 com Web Crypto API (Zero Dependências)
```javascript
export async function signPayload(payloadObj, secret) {
  const encoder = new TextEncoder();
  const data = btoa(unescape(encodeURIComponent(JSON.stringify(payloadObj))));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const sigHex = [...new Uint8Array(sigBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${data}.${sigHex}`;
}

export async function verifyPayload(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [data, sigHex] = token.split('.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data));
  if (!valid) return null;
  const payload = JSON.parse(decodeURIComponent(escape(atob(data))));
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}
```