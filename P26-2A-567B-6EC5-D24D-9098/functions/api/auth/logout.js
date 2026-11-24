/**
 * Cloudflare Pages Function — POST /api/auth/logout
 * Apaga a sessão no banco e limpa o cookie.
 */
import { SESSION_COOKIE, clearCookie, readSessionId } from "../../_lib/auth.js";
import { json, methodNotAllowed } from "../../_lib/http.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return methodNotAllowed("POST");

  try {
    const sessionId = readSessionId(request);
    if (sessionId && env.DB) {
      await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    }
  } catch {
    // Se o banco falhar, o cookie é mantido para o usuário poder tentar de novo.
    return json({ error: "Erro interno" }, 500);
  }

  return json({ ok: true }, 200, { "Set-Cookie": clearCookie(SESSION_COOKIE) });
}