/**
 * Cloudflare Pages Function — POST /api/auth/logout
 * Revoga a sessão no Cloudflare D1 e expira o cookie HttpOnly de sessão.
 */
import {
  SESSION_COOKIE_NAME,
  buildClearSessionCookie,
  deleteSession,
} from "../../../src/server/auth.js";
import { ensureSchema } from "../../../src/server/db.js";
import { jsonResponse, parseCookies } from "../../../src/server/http.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE_NAME];

  if (token && env?.DB) {
    try {
      await ensureSchema(env.DB);
      await deleteSession(env.DB, token);
    } catch {
      // Mesmo se o banco falhar, garantimos a expiração do cookie no cliente.
    }
  }

  return jsonResponse(
    { ok: true },
    200,
    {
      "Set-Cookie": buildClearSessionCookie(request),
    }
  );
}
