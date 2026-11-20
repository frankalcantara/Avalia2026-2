/** GET /api/ranking — top 10 jogadores por eficiência (partidas finalizadas). */
import { requireUser, json } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const { results } = await env.DB.prepare(
    "SELECT g.user_id AS userId, COALESCE(u.username, 'Jogador') AS username, u.avatar AS avatar, " +
    "MAX(g.efficiency) AS bestEfficiency, MIN(g.moves) AS bestMoves, COUNT(*) AS games " +
    "FROM games g LEFT JOIN discord_users u ON u.user_id = g.user_id " +
    "WHERE g.status = 'finished' GROUP BY g.user_id " +
    "ORDER BY bestEfficiency DESC, bestMoves ASC LIMIT 10"
  ).all();

  return json({ ok: true, ranking: results || [] });
}
