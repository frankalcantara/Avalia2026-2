/**
 * Cloudflare Pages Function — GET /api/status
 * Diagnóstico de deploy: conectividade D1, OAuth2 configurado e totais.
 */
import { ensureSchema, json } from "./_lib.js";

export async function onRequestGet(context) {
  const { env } = context;
  let d1Connected = false;
  const totals = { polls: 0, votes: 0, users: 0 };

  if (env.DB) {
    try {
      await ensureSchema(env);
      const [pollsResult, votesResult, usersResult] = await env.DB.batch([
        env.DB.prepare("SELECT COUNT(*) AS total FROM polls"),
        env.DB.prepare("SELECT COUNT(*) AS total FROM votes"),
        env.DB.prepare("SELECT COUNT(*) AS total FROM discord_users"),
      ]);
      totals.polls = Number(pollsResult.results?.[0]?.total || 0);
      totals.votes = Number(votesResult.results?.[0]?.total || 0);
      totals.users = Number(usersResult.results?.[0]?.total || 0);
      d1Connected = true;
    } catch {
      d1Connected = false;
    }
  }

  return json({
    ok: true,
    chave: "P26-2B-86B9-E260-A00B-F564",
    projectId: 26,
    projectTitle: "Sistema de Enquetes e Votação Verificada",
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    totals,
    serverTimestamp: new Date().toISOString(),
  });
}
