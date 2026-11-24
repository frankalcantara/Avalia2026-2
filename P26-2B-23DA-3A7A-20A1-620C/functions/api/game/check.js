/**
 * POST /api/game/check  { gameId }
 * Valida no servidor se as 2 cartas viradas formam um par.
 * Incrementa moves, e ao fim calcula duracao e eficiencia oficiais.
 */
import { getSessionUser } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return Response.json({ ok: false, error: "server_config" }, { status: 500 });
  }
  const user = await getSessionUser(request, env);
  if (!user) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const gameId = String(body.gameId || "");
  if (!gameId) {
    return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const game = await env.DB.prepare(
    "SELECT id, status, total_pairs, matched_pairs, moves, started_at FROM games WHERE id = ? AND user_id = ?"
  ).bind(gameId, user.user_id).first();
  if (!game) {
    return Response.json({ ok: false, error: "game_not_found" }, { status: 404 });
  }
  if (game.status !== "active") {
    return Response.json({ ok: false, error: "game_not_active" }, { status: 409 });
  }

  const revealed = await env.DB.prepare(
    "SELECT card_id, pair_key, kind FROM game_cards WHERE game_id = ? AND turn_revealed = 1 AND matched = 0"
  ).bind(gameId).all();
  const cards = revealed.results || [];
  if (cards.length !== 2) {
    return Response.json({ ok: false, error: "need_two_cards" }, { status: 409 });
  }

  const [a, b] = cards;
  const isMatch = a.pair_key === b.pair_key && a.kind !== b.kind;
  const newMoves = game.moves + 1;
  const newMatched = game.matched_pairs + (isMatch ? 1 : 0);
  const finished = newMatched >= game.total_pairs;

  const stmts = [];
  if (isMatch) {
    stmts.push(
      env.DB.prepare(
        "UPDATE game_cards SET matched = 1, turn_revealed = 0 WHERE game_id = ? AND card_id IN (?, ?)"
      ).bind(gameId, a.card_id, b.card_id)
    );
  } else {
    stmts.push(
      env.DB.prepare(
        "UPDATE game_cards SET turn_revealed = 0 WHERE game_id = ? AND card_id IN (?, ?)"
      ).bind(gameId, a.card_id, b.card_id)
    );
  }

  let result = { moves: newMoves, matchedPairs: newMatched, totalPairs: game.total_pairs };

  if (finished) {
    const now = Date.now();
    const durationMs = now - game.started_at;
    const efficiency = Math.round((game.total_pairs / newMoves) * 10000) / 10000;
    stmts.push(
      env.DB.prepare(
        "UPDATE games SET moves = ?, matched_pairs = ?, status = 'finished', finished_at = ?, duration_ms = ?, efficiency = ? WHERE id = ?"
      ).bind(newMoves, newMatched, now, durationMs, efficiency, gameId)
    );
    result = { ...result, finished: true, durationMs, efficiency };
  } else {
    stmts.push(
      env.DB.prepare(
        "UPDATE games SET moves = ?, matched_pairs = ? WHERE id = ?"
      ).bind(newMoves, newMatched, gameId)
    );
    result.finished = false;
  }

  await env.DB.batch(stmts);

  return Response.json(
    { ok: true, match: isMatch, cardIds: [a.card_id, b.card_id], ...result },
    { headers: { "Cache-Control": "no-store" } }
  );
}