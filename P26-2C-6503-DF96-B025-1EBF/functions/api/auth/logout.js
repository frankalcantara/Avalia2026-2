/** POST /api/auth/logout — encerra a sessão no servidor e limpa o cookie. */
import { SESSION_COOKIE, buildCookie, destroySession, isSameOrigin, json } from "../../_lib/util.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "forbidden_origin" }, 403);
  await destroySession(request, env);
  return json({ ok: true }, 200, { "Set-Cookie": buildCookie(SESSION_COOKIE, "", { maxAge: 0 }) });
}
