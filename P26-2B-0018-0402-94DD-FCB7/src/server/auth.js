/**
 * Autenticação e gerenciamento de sessões opacas no Cloudflare D1 (Discord OAuth2).
 */
import { ensureSchema } from "./db.js";
import { buildCookie, errorResponse, isHttpsRequest, parseCookies } from "./http.js";

export const SESSION_COOKIE_NAME = "jukebox_session";
export const OAUTH_STATE_COOKIE_NAME = "discord_oauth_state";
export const SESSION_TTL_SECONDS = 604800; // 7 dias

export function generateSecureToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length || a.length === 0) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSession(db, userId) {
  const token = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await db
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(token, String(userId), expiresAt)
    .run();

  return { token, expiresAt };
}

export async function deleteSession(db, token) {
  if (!db || !token || typeof token !== "string") return;

  await db
    .prepare("DELETE FROM sessions WHERE token = ?")
    .bind(token)
    .run();
}

export async function getSessionUser(request, env) {
  if (!env?.DB) return null;

  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token || typeof token !== "string" || token.length > 256) {
    return null;
  }

  try {
    await ensureSchema(env.DB);
    const nowIso = new Date().toISOString();

    const row = await env.DB
      .prepare(
        `SELECT
          s.token AS session_token,
          s.expires_at AS session_expires_at,
          u.user_id,
          u.username,
          u.avatar
        FROM sessions s
        INNER JOIN discord_users u ON u.user_id = s.user_id
        WHERE s.token = ?
        LIMIT 1`
      )
      .bind(token)
      .first();

    if (!row) {
      return null;
    }

    const expiresMs = Date.parse(row.session_expires_at);
    const isExpired =
      !Number.isFinite(expiresMs)
        ? String(row.session_expires_at) <= nowIso
        : expiresMs <= Date.now();

    if (isExpired) {
      await deleteSession(env.DB, token).catch(() => {});
      return null;
    }

    return {
      user_id: row.user_id,
      username: row.username,
      avatar: row.avatar ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) {
    return {
      user: null,
      response: errorResponse(
        "Você precisa estar autenticado via Discord para realizar esta ação.",
        "UNAUTHORIZED",
        401
      ),
    };
  }

  return { user, response: null };
}

export function buildSessionCookie(token, request, maxAge = SESSION_TTL_SECONDS) {
  return buildCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge,
    secure: isHttpsRequest(request),
  });
}

export function buildClearSessionCookie(request) {
  return buildCookie(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
    secure: isHttpsRequest(request),
  });
}

export function buildOAuthStateCookie(state, request, maxAge = 600) {
  return buildCookie(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge,
    secure: isHttpsRequest(request),
  });
}

export function buildClearOAuthStateCookie(request) {
  return buildCookie(OAUTH_STATE_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
    secure: isHttpsRequest(request),
  });
}
