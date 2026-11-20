/**
 * Cloudflare Pages Function — /api/status
 * Diagnóstico: conectividade com o D1 e sessão Discord (cookie assinado).
 */
import { getSession, json } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const sessionUser = await getSession(request, env);
  let d1Connected = false;
  let partidas = 0;
  let finalizadas = 0;

  if (env.DB) {
    try {
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END), 0) AS fin FROM games"
      ).first();
      partidas = Number(row?.total || 0);
      finalizadas = Number(row?.fin || 0);
      d1Connected = true;
    } catch {
      d1Connected = false;
    }
  }

  return json({
    ok: true,
    chave: "P26-2C-50B3-F413-07FD-8793",
    projectId: 7,
    projectTitle: "Jogo da Memória Temático",
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID),
    sessionUser,
    partidas,
    finalizadas,
    serverTimestamp: new Date().toISOString(),
  });
}
