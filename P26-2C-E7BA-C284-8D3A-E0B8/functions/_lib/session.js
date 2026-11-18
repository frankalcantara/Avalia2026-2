/**
 * Helper de sessão assinada (HMAC-SHA256) para as Cloudflare Pages Functions.
 *
 * O cookie tem o formato:  <payload em base64url>.<assinatura em base64url>
 * Só quem conhece SESSION_SECRET consegue gerar uma assinatura válida,
 * então o cliente não consegue forjar nem alterar a sessão.
 *
 * Este arquivo não exporta onRequest*, então NÃO vira uma rota da API.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ---------- utilitários de base64url ----------

function bytesToB64Url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// ---------- chave HMAC ----------

function importKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// ---------- API pública ----------

/**
 * Cria o valor assinado do cookie.
 * user = { userId, username, avatar }
 */
export async function createSessionValue(user, secret, maxAgeSeconds = 86400) {
  const payload = {
    userId: user.userId,
    username: user.username,
    avatar: user.avatar,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const body = bytesToB64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return body + "." + bytesToB64Url(new Uint8Array(sig));
}

/**
 * Lê e valida a sessão da requisição.
 * Retorna { userId, username, avatar, exp } ou null se não houver
 * cookie, a assinatura for inválida ou a sessão tiver expirado.
 */
export async function readSession(request, env) {
  if (!env.SESSION_SECRET) return null;

  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)discord_session=([^;]+)/);
  if (!match) return null;

  const parts = match[1].split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, sig] = parts;

  try {
    const key = await importKey(env.SESSION_SECRET);
    // verify() compara em tempo constante (evita timing attack)
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64UrlToBytes(sig),
      encoder.encode(body)
    );
    if (!ok) return null;

    const payload = JSON.parse(decoder.decode(b64UrlToBytes(body)));
    if (!payload.userId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Monta o header Set-Cookie da sessão. */
export function buildSessionCookie(value, maxAgeSeconds = 86400) {
  return `discord_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

/** Monta um Set-Cookie que apaga o cookie com o nome dado. */
export function buildClearCookie(name = "discord_session") {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}