/**
 * POST /api/auth/logout
 * Encerra a sessão apagando o cookie. O cookie é HttpOnly, então o JavaScript
 * do navegador não consegue apagá-lo sozinho: precisa ser o servidor.
 */
import { buildClearCookie } from "../../_lib/session.js";

export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": buildClearCookie("discord_session"),
    },
  });
}