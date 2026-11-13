/**
 * /api/games
 * GET: partida em andamento do jogador logado (ou null).
 * POST: cria uma partida para o jogador logado (ou devolve a que já está em andamento).
 */
import { json, requireUser } from "../../_lib/http.js";
import { FLEET } from "../../_lib/game.js";

export async function onRequestPost(context) {
  const { env } = context;
  const auth = await requireUser(context);
  if (auth.response) return auth.response;
  const { user } = auth;

  const active = await env.DB.prepare(
    "SELECT id, status, turn FROM games WHERE user_id = ? AND status != 'finalizada' ORDER BY id DESC LIMIT 1"
  ).bind(user.userId).first();
  if (active) return json({ ok: true, created: false, game: active, fleet: FLEET });

  const res = await env.DB.prepare("INSERT INTO games (user_id) VALUES (?)").bind(user.userId).run();
  const game = { id: res.meta.last_row_id, status: "posicionando", turn: "player" };
  return json({ ok: true, created: true, game, fleet: FLEET }, 201);
}

export async function onRequestGet(context) {
  const { env } = context;
  const auth = await requireUser(context);
  if (auth.response) return auth.response;
  const active = await env.DB.prepare(
    "SELECT id, status, turn FROM games WHERE user_id = ? AND status != 'finalizada' ORDER BY id DESC LIMIT 1"
  ).bind(auth.user.userId).first();
  return json({ ok: true, game: active || null, fleet: FLEET });
}
