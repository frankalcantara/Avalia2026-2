/**
 * POST /api/game/pick {gameId, token}
 * 1ª carta do movimento: grava como pendente e revela a face.
 * 2ª carta: o SERVIDOR confere o par, incrementa moves no D1 e, no último par, grava a eficiência.
 */
import { json, readSession, sameOrigin } from "../../_lib/util.js";

const face = (c) => ({ token: c.token, kind: c.kind, text: c.text });

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "forbidden_origin" }, 403);
  const user = await readSession(request, env);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (!env.DB) return json({ error: "db_unavailable" }, 503);

  const body = await request.json().catch(() => null);
  const gameId = typeof body?.gameId === "string" ? body.gameId : "";
  const token = typeof body?.token === "string" ? body.token : "";
  if (!gameId || !token || gameId.length > 64 || token.length > 64) return json({ error: "invalid_payload" }, 400);

  const game = await env.DB.prepare("SELECT * FROM games WHERE id = ? AND user_id = ?").bind(gameId, user.userId).first();
  if (!game) return json({ error: "game_not_found" }, 404);
  if (game.status !== "active") return json({ error: "game_not_active" }, 409);

  const card = await env.DB.prepare(
    "SELECT token, pair_id, kind, text, matched FROM game_cards WHERE token = ? AND game_id = ?"
  ).bind(token, gameId).first();
  if (!card) return json({ error: "card_not_found" }, 404);
  if (card.matched) return json({ error: "card_already_matched" }, 409);

  // ---- 1ª carta ----
  if (!game.pending_card) {
    const r = await env.DB.prepare(
      "UPDATE games SET pending_card = ? WHERE id = ? AND status = 'active' AND pending_card IS NULL"
    ).bind(token, gameId).run();
    if (r.meta.changes !== 1) return json({ error: "conflict" }, 409);
    return json({ state: "first", card: face(card), moves: game.moves });
  }

  // ---- 2ª carta ----
  if (game.pending_card === token) return json({ error: "same_card" }, 409);

  const first = await env.DB.prepare(
    "SELECT token, pair_id, kind, text FROM game_cards WHERE token = ? AND game_id = ?"
  ).bind(game.pending_card, gameId).first();
  if (!first) return json({ error: "inconsistent_state" }, 409);

  const match = first.pair_id === card.pair_id;
  const moves = game.moves + 1;
  const pairsFound = game.pairs_found + (match ? 1 : 0);
  const finished = match && pairsFound === game.pairs_total;
  const efficiency = finished ? Math.round((game.pairs_total / moves) * 1000) / 10 : null;

  const upd = await env.DB.prepare(
    "UPDATE games SET moves = ?, pairs_found = ?, pending_card = NULL, status = ?, efficiency = ?, " +
    "finished_at = CASE WHEN ? = 'finished' THEN CURRENT_TIMESTAMP ELSE NULL END " +
    "WHERE id = ? AND status = 'active' AND pending_card = ?"
  ).bind(moves, pairsFound, finished ? "finished" : "active", efficiency, finished ? "finished" : "active", gameId, game.pending_card).run();
  if (upd.meta.changes !== 1) return json({ error: "conflict" }, 409);

  if (match) {
    await env.DB.prepare("UPDATE game_cards SET matched = 1 WHERE game_id = ? AND token IN (?, ?)")
      .bind(gameId, first.token, card.token).run();
  }

  return json({
    state: "second",
    match,
    first: face(first),
    second: face(card),
    moves,
    pairsFound,
    pairsTotal: game.pairs_total,
    finished,
    efficiency,
  });
}
