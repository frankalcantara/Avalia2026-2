/** GET /api/status — diagnóstico rápido: D1 conectado? Discord configurado? */
import { json } from "../_lib/http.js";
import { CHAVE_UNICA } from "../_lib/rules.js";

export async function onRequestGet({ env }) {
  let d1Connected = false;
  let totalTickets = null;
  if (env.DB) {
    try {
      const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM tickets").first();
      d1Connected = true;
      totalTickets = row.n;
    } catch {
      d1Connected = false;
    }
  }
  return json({
    ok: true,
    chave: CHAVE_UNICA,
    projeto: "#38 — Rastreador de Solicitações e Chamados Internos (Issue Tracker)",
    d1Connected,
    totalTickets,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    serverTimestamp: new Date().toISOString(),
  });
}
