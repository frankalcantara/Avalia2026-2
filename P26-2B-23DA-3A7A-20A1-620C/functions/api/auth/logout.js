/**
 * POST /api/auth/logout - apaga a sessao no D1 e limpa o cookie.
 * Outros metodos recebem 405.
 */
import { getCookie, sha256Hex } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const token = getCookie(request, "session");

  if (token && env.DB) {
    const hash = await sha256Hex(token);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hash).run();
  }

  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
        "Cache-Control": "no-store",
      },
    }
  );
}

export function onRequest() {
  return Response.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: { Allow: "POST" } }
  );
}