/**
 * POST /api/game/start
 * Sorteia os pares, embaralha no servidor e devolve so IDs opacos.
 * pair_key e conteudo das cartas nunca saem daqui.
 */
import { getSessionUser, randomToken } from "../../_lib/auth.js";
import { PAIRS, PAIRS_PER_GAME } from "../../_lib/pairs.js";

// Inteiro aleatorio em [0, max) sem vies (rejection sampling).
function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

// Fisher-Yates com aleatoriedade criptografica.
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return Response.json({ ok: false, error: "server_config" }, { status: 500 });
  }
  const user = await getSessionUser(request, env);
  if (!user) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const chosen = shuffle(PAIRS).slice(0, PAIRS_PER_GAME);

  const cards = [];
  for (const p of chosen) {
    cards.push({ pairKey: p.key, kind: "code", content: p.code });
    cards.push({ pairKey: p.key, kind: "output", content: p.output });
  }
  const board = shuffle(cards).map((c, i) => ({
    ...c,
    cardId: randomToken(8),
    position: i,
  }));

  const gameId = randomToken(16);
  const now = Date.now();

  const stmts = [
    env.DB.prepare(
      "UPDATE games SET status = 'abandoned' WHERE user_id = ? AND status = 'active'"
    ).bind(user.user_id),
    env.DB.prepare(
      "INSERT INTO games (id, user_id, total_pairs, started_at) VALUES (?, ?, ?, ?)"
    ).bind(gameId, user.user_id, PAIRS_PER_GAME, now),
  ];
  for (const c of board) {
    stmts.push(
      env.DB.prepare(
        "INSERT INTO game_cards (game_id, card_id, pair_key, kind, content, position) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(gameId, c.cardId, c.pairKey, c.kind, c.content, c.position)
    );
  }
  await env.DB.batch(stmts);

  return Response.json(
    {
      ok: true,
      gameId,
      totalPairs: PAIRS_PER_GAME,
      moves: 0,
      cards: board.map((c) => ({ id: c.cardId, position: c.position })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}