// Cookies do projeto. Todos com prefixo __Host- (exige Secure, Path=/ e sem Domain).

export const TX_COOKIE = "__Host-oauth-tx";
export const NEXT_COOKIE = "__Host-oauth-next";
export const SESSION_COOKIE = "__Host-session";

export const TX_MAX_AGE = 600; // 10 minutos (segundos)
export const SESSION_MAX_AGE = 28800; // 8 horas (segundos)

export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const cookies = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name && !(name in cookies)) cookies[name] = value;
  }
  return cookies;
}

function build(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export const txCookie = (value) => build(TX_COOKIE, value, TX_MAX_AGE);
export const clearTxCookie = () => build(TX_COOKIE, "", 0);

export const nextCookie = (value) => build(NEXT_COOKIE, encodeURIComponent(value), TX_MAX_AGE);
export const clearNextCookie = () => build(NEXT_COOKIE, "", 0);

export const sessionCookie = (value) => build(SESSION_COOKIE, value, SESSION_MAX_AGE);
export const clearSessionCookie = () => build(SESSION_COOKIE, "", 0);
