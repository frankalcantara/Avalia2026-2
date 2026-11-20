export function json(data, status = 200, headers = {}) {
  const mergedHeaders = new Headers(headers);
  mergedHeaders.set("Cache-Control", "no-store");
  return Response.json(data, { status, headers: mergedHeaders });
}

export function failure(error, status, message = error) {
  return json({ ok: false, error, message }, status);
}

export function requireDatabase(env) {
  return env.DB ? null : failure("database_unavailable", 503, "Banco de dados indisponível.");
}

export function isUniqueConstraintError(error) {
  const details = [
    error?.message,
    error?.cause?.message,
    error?.code,
    error?.cause?.code,
  ].filter(Boolean).join(" ").toUpperCase();
  return details.includes("UNIQUE CONSTRAINT FAILED")
    || details.includes("SQLITE_CONSTRAINT_UNIQUE")
    || details.includes("CONSTRAINT_UNIQUE");
}

export function databaseFailure() {
  return failure("database_error", 500, "Erro operacional ao acessar o banco de dados.");
}

export function readCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  for (const part of cookies.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

export function cookie(name, value, maxAge, path = "/") {
  return `${name}=${value}; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function requireSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin === new URL(request.url).origin;
}

export async function getSessionUser(context) {
  const token = readCookie(context.request, "discord_session");
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !context.env.DB) return null;

  return context.env.DB.prepare(
    `SELECT users.user_id, users.username, users.global_name, users.avatar
     FROM sessions
     JOIN discord_users AS users ON users.user_id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`
  ).bind(await sha256(token), new Date().toISOString()).first();
}

export async function authenticate(context) {
  let user;
  try {
    user = await getSessionUser(context);
  } catch {
    return { user: null, response: databaseFailure() };
  }
  return user
    ? { user, response: null }
    : { user: null, response: failure("unauthorized", 401, "Autenticação Discord necessária.") };
}

export async function readJsonObject(request) {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function validId(rawId) {
  if (!/^\d+$/.test(String(rawId || ""))) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}