/**
 * POST /api/game/flip  { gameId, cardId }
 * Revela o conteúdo de UMA carta. O servidor impede ter mais de 2 cartas
 * viradas sem validação, então o cliente não consegue "espiar" o tabuleiro.
 */
import { requireUser, readBody, str, json } from "../../_lib/session.js";

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const body = await readBody(request);
  const gameId = str(body.gameId);
  const cardId = str(body.cardId);
  if (!gameId || !cardId) return json({ ok: false, error: "invalid_request" }, 400);

  const game = await env.DB.prepare("SELECT id, status FROM games WHERE id = ? AND user_id = ?")
    .bind(gameId, auth.user.userId).first();
  if (!game) return json({ ok: false, error: "game_not_found" }, 404);
  if (game.status !== "active") return json({ ok: false, error: "game_not_active" }, 409);

  const card = await env.DB.prepare("SELECT kind, content, revealed, matched FROM game_cards WHERE game_id = ? AND card_id = ?")
    .bind(gameId, cardId).first();
  if (!card) return json({ ok: false, error: "card_not_found" }, 404);
  if (card.matched) return json({ ok: false, error: "card_already_matched" }, 409);
  if (card.revealed) return json({ ok: true, kind: card.kind, content: card.content });

  // Atômico: só vira se houver menos de 2 cartas viradas pendentes.
  const upd = await env.DB.prepare(
    "UPDATE game_cards SET revealed = 1 WHERE game_id = ? AND card_id = ? AND revealed = 0 AND matched = 0 " +
    "AND (SELECT COUNT(*) FROM game_cards WHERE game_id = ? AND revealed = 1) < 2"
  ).bind(gameId, cardId, gameId).run();

  if (!upd.meta || upd.meta.changes !== 1) {
    return json({ ok: false, error: "too_many_cards_flipped" }, 409);
  }
  return json({ ok: true, kind: card.kind, content: card.content });
}
