/**
 * POST /api/game/reveal  { gameId, cardId }
 * Devolve o conteudo de UMA carta, respeitando o limite de 2 viradas por turno.
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
  const cardId = String(body.cardId || "");
  if (!gameId || !cardId) {
    return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const game = await env.DB.prepare(
    "SELECT id, status FROM games WHERE id = ? AND user_id = ?"
  ).bind(gameId, user.user_id).first();
  if (!game) {
    return Response.json({ ok: false, error: "game_not_found" }, { status: 404 });
  }
  if (game.status !== "active") {
    return Response.json({ ok: false, error: "game_not_active" }, { status: 409 });
  }

  const card = await env.DB.prepare(
    "SELECT card_id, kind, content, matched, turn_revealed FROM game_cards WHERE game_id = ? AND card_id = ?"
  ).bind(gameId, cardId).first();
  if (!card) {
    return Response.json({ ok: false, error: "card_not_found" }, { status: 404 });
  }
  if (card.matched) {
    return Response.json({ ok: false, error: "already_matched" }, { status: 409 });
  }
  if (card.turn_revealed) {
    return Response.json({ ok: false, error: "already_revealed" }, { status: 409 });
  }

  // Update condicional: so vira se houver menos de 2 viradas (atomico).
  const res = await env.DB.prepare(
    "UPDATE game_cards SET turn_revealed = 1 WHERE game_id = ? AND card_id = ? AND turn_revealed = 0 AND (SELECT COUNT(*) FROM game_cards WHERE game_id = ? AND turn_revealed = 1) < 2"
  ).bind(gameId, cardId, gameId).run();

  if (!res.meta || res.meta.changes !== 1) {
    return Response.json({ ok: false, error: "turn_full" }, { status: 409 });
  }

  return Response.json(
    { ok: true, cardId: card.card_id, kind: card.kind, content: card.content },
    { headers: { "Cache-Control": "no-store" } }
  );
}