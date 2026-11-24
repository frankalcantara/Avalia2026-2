/** POST /api/auth/logout — encerra a sessão no D1 e apaga o cookie. */
import { json } from "../../../src/lib/http.js";
import { destroySession } from "../../../src/lib/session.js";

export async function onRequestPost({ request, env }) {
  const clear = await destroySession(env.DB, request);
  return json({ ok: true }, 200, { "Set-Cookie": clear });
}
