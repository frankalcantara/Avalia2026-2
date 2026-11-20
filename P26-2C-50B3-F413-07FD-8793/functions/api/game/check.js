/**
 * POST /api/game/check  { gameId, cardA, cardB }
 * O servidor decide se as duas cartas viradas formam um par, incrementa o
 * contador de movimentos no D1 e, ao achar o último par, grava a eficiência
 * (pares / movimentos x 100). O cliente nunca decide nada disso.
 */
import { requireUser, readBody, str, json } from "../../_lib/session.js";

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const body = await readBody(request);
  const gameId = str(body.gameId);
  const cardA = str(body.cardA);
  const cardB = str(body.cardB);
  if (!gameId || !cardA || !cardB || cardA === cardB) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const game = await env.DB.prepare("SELECT id, status FROM games WHERE id = ? AND user_id = ?")
    .bind(gameId, auth.user.userId).first();
  if (!game) return json({ ok: false, error: "game_not_found" }, 404);
  if (game.status !== "active") return json({ ok: false, error: "game_not_active" }, 409);

  const { results } = await env.DB.prepare(
    "SELECT card_id, pair_key, revealed, matched FROM game_cards WHERE game_id = ? AND card_id IN (?, ?)"
  ).bind(gameId, cardA, cardB).all();

  if (!results || results.length !== 2) return json({ ok: false, error: "card_not_found" }, 404);
  if (results.some((c) => !c.revealed || c.matched)) {
    return json({ ok: false, error: "cards_not_flipped" }, 409);
  }

  const match = results[0].pair_key === results[1].pair_key;

  // Condicional: evita contar duas vezes se o mesmo par for enviado em paralelo.
  const upd = await env.DB.prepare(
    "UPDATE game_cards SET revealed = 0, matched = ? WHERE game_id = ? AND card_id IN (?, ?) AND revealed = 1 AND matched = 0"
  ).bind(match ? 1 : 0, gameId, cardA, cardB).run();
  if (!upd.meta || upd.meta.changes !== 2) return json({ ok: false, error: "conflict" }, 409);

  const m = match ? 1 : 0;
  await env.DB.prepare(
    "UPDATE games SET moves = moves + 1, matched_pairs = matched_pairs + ?, " +
    "status = CASE WHEN matched_pairs + ? >= total_pairs THEN 'finished' ELSE status END, " +
    "finished_at = CASE WHEN matched_pairs + ? >= total_pairs THEN CURRENT_TIMESTAMP ELSE finished_at END, " +
    "efficiency = CASE WHEN matched_pairs + ? >= total_pairs THEN ROUND(total_pairs * 100.0 / (moves + 1), 1) ELSE efficiency END " +
    "WHERE id = ?"
  ).bind(m, m, m, m, gameId).run();

  const state = await env.DB.prepare(
    "SELECT moves, matched_pairs, total_pairs, status, efficiency FROM games WHERE id = ?"
  ).bind(gameId).first();

  return json({
    ok: true,
    match,
    moves: state.moves,
    matchedPairs: state.matched_pairs,
    totalPairs: state.total_pairs,
    finished: state.status === "finished",
    efficiency: state.efficiency,
  });
}
