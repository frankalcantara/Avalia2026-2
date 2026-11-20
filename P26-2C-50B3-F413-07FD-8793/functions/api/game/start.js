/**
 * POST /api/game/start
 * Embaralha o baralho NO SERVIDOR, grava a partida no D1 e devolve apenas
 * a lista de identificadores opacos (na ordem da grade). Nenhum conteúdo,
 * nenhuma chave de par.
 */
import { requireUser, json } from "../../_lib/session.js";
import { buildDeck } from "../../_lib/deck.js";

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const { user } = auth;

  const deck = buildDeck();
  const totalPairs = deck.length / 2;
  const gameId = crypto.randomUUID();

  // Uma partida ativa por jogador: a anterior é marcada como abandonada.
  await env.DB.prepare("UPDATE games SET status = 'abandoned' WHERE user_id = ? AND status = 'active'")
    .bind(user.userId).run();

  await env.DB.batch([
    env.DB.prepare("INSERT INTO games (id, user_id, status, total_pairs) VALUES (?, ?, 'active', ?)")
      .bind(gameId, user.userId, totalPairs),
    ...deck.map((c) =>
      env.DB.prepare("INSERT INTO game_cards (game_id, card_id, pair_key, kind, content) VALUES (?, ?, ?, ?, ?)")
        .bind(gameId, c.cardId, c.pairKey, c.kind, c.content)
    ),
  ]);

  return json({ ok: true, gameId, totalPairs, moves: 0, cards: deck.map((c) => c.cardId) }, 201);
}
