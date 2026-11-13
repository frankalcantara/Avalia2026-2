/**
 * Cloudflare Pages Function — POST /api/auth/logout
 * Remove o cookie de sessão assinado.
 */
import { clearSessionCookie, json } from "../_lib.js";

export async function onRequestPost(context) {
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(context.request) });
}
