/** GET /api/game/leaderboard — melhores partidas finalizadas (exige login). */
import { json, readSession } from "../../_lib/util.js";

export async function onRequestGet({ request, env }) {
  const user = await readSession(request, env);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (!env.DB) return json({ error: "db_unavailable" }, 503);

  const { results } = await env.DB.prepare(
    "SELECT COALESCE(u.username, 'Jogador') AS username, g.moves, g.efficiency " +
    "FROM games g LEFT JOIN discord_users u ON u.user_id = g.user_id " +
    "WHERE g.status = 'finished' ORDER BY g.efficiency DESC, g.moves ASC, g.finished_at ASC LIMIT 10"
  ).all();
  return json({ entries: results || [] });
}
