/**
 * POST /api/games/:id/fleet
 * Recebe a posição da frota do jogador, valida tudo no servidor, sorteia a frota do
 * computador (que nunca é enviada ao cliente) e inicia o combate.
 */
import { json, fail, requireUser, parseGameId } from "../../../_lib/http.js";
import { validateFleet, randomFleet } from "../../../_lib/game.js";

export async function onRequestPost(context) {
  const { env, request, params } = context;
  const auth = await requireUser(context);
  if (auth.response) return auth.response;

  const gameId = parseGameId(params);
  if (!gameId) return fail(400, "Partida inválida.");

  // A partida precisa ser do jogador logado (o cliente nunca informa de quem é).
  const game = await env.DB.prepare("SELECT id, status FROM games WHERE id = ? AND user_id = ?")
    .bind(gameId, auth.user.userId).first();
  if (!game) return fail(404, "Partida não encontrada.");
  if (game.status !== "posicionando") return fail(409, "A frota desta partida já foi posicionada.");

  const body = await request.json().catch(() => null);
  const { error, placed } = validateFleet(body?.ships);
  if (error) return fail(400, error);

  const insertShip = env.DB.prepare(
    "INSERT INTO ships (game_id, owner, name, size, row, col, orientation) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const toStatement = (owner) => (s) => insertShip.bind(gameId, owner, s.name, s.size, s.row, s.col, s.orientation);

  try {
    // batch = tudo ou nada: se algo falhar (ex.: duas requisições ao mesmo tempo), nada é gravado.
    await env.DB.batch([
      ...placed.map(toStatement("player")),
      ...randomFleet().map(toStatement("cpu")),
      env.DB.prepare("UPDATE games SET status = 'em_combate', turn = 'player' WHERE id = ? AND status = 'posicionando'")
        .bind(gameId),
    ]);
  } catch (err) {
    console.error("Falha ao posicionar a frota:", err);
    return fail(409, "Não foi possível posicionar a frota (talvez já tenha sido posicionada).");
  }

  return json({ ok: true, game: { id: gameId, status: "em_combate", turn: "player" } });
}
