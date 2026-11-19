// POST /api/auth/logout — apaga a sessão no D1 e expira o cookie.
import { json, error, checkOrigin } from "../../_lib/http.js";
import { clearCookie } from "../../_lib/cookies.js";
import { SESSION_COOKIE, sessionHash, getUser } from "../../_lib/session.js";

export async function onRequestPost({ request, env }) {
  const bad = checkOrigin(request);
  if (bad) return bad;

  const expire = { "Set-Cookie": clearCookie(SESSION_COOKIE) };
  const user = await getUser(env, request);
  if (!user) {
    // sem sessão válida: 401, mas o cookie é expirado mesmo assim
    return error(401, "unauthorized", "Nenhuma sessão ativa.", {}, expire);
  }
  const hash = await sessionHash(request);
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hash).run();
  return json({ ok: true }, 200, expire);
}
