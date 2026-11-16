/**
 * POST /api/game/start — o servidor embaralha e devolve só identificadores opacos (tokens).
 */
import { json, readSession, sameOrigin, shuffle, randomToken } from "../../_lib/util.js";
import { PAIRS, PAIRS_PER_GAME } from "../../_lib/pairs.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "forbidden_origin" }, 403);
  const user = await readSession(request, env);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (!env.DB) return json({ error: "db_unavailable" }, 503);

  const gameId = crypto.randomUUID();
  const chosen = shuffle(PAIRS).slice(0, PAIRS_PER_GAME);
  const cards = shuffle(
    chosen.flatMap((p, pairId) => [
      { pairId, kind: "code", text: p.code },
      { pairId, kind: "output", text: p.output },
    ])
  ).map((c, position) => ({ ...c, position, token: randomToken() }));

  await env.DB.batch([
    env.DB.prepare("UPDATE games SET status = 'abandoned' WHERE user_id = ? AND status = 'active'").bind(user.userId),
    env.DB.prepare("INSERT INTO games (id, user_id, pairs_total) VALUES (?, ?, ?)").bind(gameId, user.userId, chosen.length),
    ...cards.map((c) =>
      env.DB.prepare(
        "INSERT INTO game_cards (token, game_id, position, pair_id, kind, text) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(c.token, gameId, c.position, c.pairId, c.kind, c.text)
    ),
  ]);

  return json({ gameId, pairsTotal: chosen.length, moves: 0, cards: cards.map((c) => ({ token: c.token })) });
}
