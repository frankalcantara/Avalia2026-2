/** POST /api/auth/logout — encerra a sessão apagando o cookie. */
import { json, buildCookie, sameOrigin, SESSION_COOKIE } from "../../_lib/util.js";

export async function onRequestPost({ request }) {
  if (!sameOrigin(request)) return json({ error: "forbidden_origin" }, 403);
  return json({ ok: true }, 200, { "Set-Cookie": buildCookie(SESSION_COOKIE, "", request, 0) });
}
