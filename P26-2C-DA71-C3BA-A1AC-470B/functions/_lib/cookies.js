// Leitura e escrita de cookies.

// Converte o header Cookie em objeto { nome: valor }.
export function parseCookies(request) {
  const out = {};
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (!name || name in out) continue;
    const raw = part.slice(i + 1).trim();
    try {
      out[name] = decodeURIComponent(raw);
    } catch {
      out[name] = raw;
    }
  }
  return out;
}

// Monta um Set-Cookie seguro (HttpOnly, Secure, SameSite=Lax, Path=/).
export function serializeCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// Cookie que expira imediatamente.
export function clearCookie(name) {
  return serializeCookie(name, "", 0);
}
