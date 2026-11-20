import { cookie, failure, readCookie, requireDatabase, requireSameOrigin, sha256 } from "../../_shared.js";

export async function onRequestPost({ request, env }) {
  if (!requireSameOrigin(request)) return failure("csrf_rejected", 403, "Origem da requisição inválida.");
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const token = readCookie(request, "discord_session");
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": cookie("discord_session", "", 0),
      "Cache-Control": "no-store",
    },
  });
}