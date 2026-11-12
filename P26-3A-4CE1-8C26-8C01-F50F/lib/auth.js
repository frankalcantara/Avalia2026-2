export const SESSION_COOKIE = "discord_session";
export const STATE_COOKIE = "discord_oauth_state";
export const SESSION_MAX_AGE = 86400;
export const STATE_MAX_AGE = 600;

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export function isToken(value) {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function readToken(request, name = SESSION_COOKIE) {
  const cookies = (request.headers.get("Cookie") || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${name}=`));

  // Nomes duplicados são ambíguos; cookies antigos em JSON também são rejeitados.
  if (cookies.length !== 1) return null;
  const value = cookies[0].slice(name.length + 1);
  return isToken(value) ? value : null;
}

export function cookie(name, value, maxAge, path = "/") {
  const expires = maxAge === 0 ? "; Expires=Thu, 01 Jan 1970 00:00:00 GMT" : "";
  return `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure${expires}`;
}

export function clearStateCookie() {
  return cookie(STATE_COOKIE, "", 0, "/api/auth/discord");
}

export function jsonError(error, status, extraHeaders = {}) {
  return Response.json({ ok: false, error }, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

export function requireUser(context) {
  if (context.data?.authError) return jsonError("database_unavailable", 503);
  if (!context.data?.user) return jsonError("unauthenticated", 401);
  return null;
}

export function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  // Clientes sem Origin podem usar a API; origens externas do navegador são rejeitadas.
  return origin === null || origin === new URL(request.url).origin;
}
