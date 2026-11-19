/**
 * Cloudflare Pages Function: POST /api/auth/logout
 * Deletes the server-side session and clears the cookie.
 */
import { cookie, getCookie, json, sha256Hex } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const token = getCookie(request, "session");
  if (env.DB && token && /^[a-f0-9]{64}$/.test(token)) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(await sha256Hex(token)).run();
  }
  const response = json({ ok: true });
  response.headers.append("Set-Cookie", cookie("session", "", 0));
  return response;
}
