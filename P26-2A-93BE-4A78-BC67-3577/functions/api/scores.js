/**
 * GET /api/scores — placar geral (público), atualizado ao fim de cada partida.
 */
import { json } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT u.username, u.avatar, u.user_id AS userId, s.games_played AS gamesPlayed, s.wins, s.losses
       FROM scores s JOIN discord_users u ON u.user_id = s.user_id
      ORDER BY s.wins DESC, s.games_played ASC, s.updated_at ASC
      LIMIT 20`
  ).all();
  return json({ ok: true, scores: results });
}
