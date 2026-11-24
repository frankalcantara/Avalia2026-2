/** POST /api/auth/logout — encerra a sessão no D1 e apaga o cookie. */
import { destroySession } from "../../_lib/session.js";
import { json, fail, sameOrigin } from "../../_lib/http.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return fail(403, "Origem não permitida.");
  const clear = await destroySession(request, env);
  return json({ ok: true }, 200, { "Set-Cookie": clear });
}
