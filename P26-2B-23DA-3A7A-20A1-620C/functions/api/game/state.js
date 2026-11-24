/**
 * GET /api/game/state
 * Retoma a partida ativa do usuario. Nunca expoe pair_key
 * nem o conteudo de cartas ainda escondidas.
 */
import { getSessionUser } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return Response.json({ ok: false, error: "server_config" }, { status: 500 });
  }
  const user = await getSessionUser(request, env);
  if (!user) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const game = await env.DB.prepare(
    "SELECT id, total_pairs, matched_pairs, moves, started_at FROM games WHERE user_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1"
  ).bind(user.user_id).first();

  const headers = { "Cache-Control": "no-store" };
  if (!game) {
    return Response.json({ ok: true, game: null }, { headers });
  }

  const rows = await env.DB.prepare(
    "SELECT card_id, kind, content, position, matched, turn_revealed FROM game_cards WHERE game_id = ? ORDER BY position"
  ).bind(game.id).all();

  const cards = (rows.results || []).map((c) => {
    const visible = c.matched === 1 || c.turn_revealed === 1;
    const card = {
      id: c.card_id,
      position: c.position,
      matched: c.matched === 1,
      revealed: c.turn_revealed === 1,
    };
    if (visible) {
      card.kind = c.kind;
      card.content = c.content;
    }
    return card;
  });

  return Response.json(
    {
      ok: true,
      game: {
        gameId: game.id,
        totalPairs: game.total_pairs,
        matchedPairs: game.matched_pairs,
        moves: game.moves,
        startedAt: game.started_at,
        serverNow: Date.now(),
        cards,
      },
    },
    { headers }
  );
}