import {
  SESSION_COOKIE, cookie, hashToken, isSameOrigin, jsonError, readToken,
} from "../../../lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isSameOrigin(request)) return jsonError("invalid_origin", 403);

  const headers = {
    "Cache-Control": "no-store",
    "Set-Cookie": cookie(SESSION_COOKIE, "", 0),
  };
  const token = readToken(request);

  if (token) {
    try {
      if (!env.DB) throw new Error("D1 indisponível");
      await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
        .bind(await hashToken(token)).run();
    } catch {
      return jsonError("database_unavailable", 503, headers);
    }
  }

  return new Response(null, { status: 204, headers });
}
