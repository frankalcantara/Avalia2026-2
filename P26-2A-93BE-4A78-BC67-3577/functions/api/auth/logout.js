/**
 * POST /api/auth/logout — apaga a sessão no D1 e limpa o cookie.
 */
import { json } from "../../_lib/http.js";
import { SESSION_COOKIE, getCookie } from "../../_lib/session.js";

export async function onRequestPost({ env, request }) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token && env.DB) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(token).run();
  }
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`);
  return res;
}
