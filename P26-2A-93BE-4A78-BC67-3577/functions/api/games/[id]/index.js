/**
 * GET /api/games/:id
 * Estado da partida para o jogador dono dela. A matriz do computador nunca é revelada:
 * só quantos navios restam e quais já foram afundados.
 */
import { json, fail, requireUser, parseGameId } from "../../../_lib/http.js";
import { FLEET } from "../../../_lib/game.js";

export async function onRequestGet(context) {
  const { env, params } = context;
  const auth = await requireUser(context);
  if (auth.response) return auth.response;

  const gameId = parseGameId(params);
  if (!gameId) return fail(400, "Partida inválida.");

  const game = await env.DB.prepare(
    "SELECT id, status, turn, winner, created_at, finished_at FROM games WHERE id = ? AND user_id = ?"
  ).bind(gameId, auth.user.userId).first();
  if (!game) return fail(404, "Partida não encontrada.");

  const [playerShips, cpuShips, shots] = await Promise.all([
    env.DB.prepare("SELECT name, size, row, col, orientation, hits FROM ships WHERE game_id = ? AND owner = 'player'").bind(gameId).all(),
    // Para o computador, NÃO se seleciona row/col/orientation: a posição fica só no servidor.
    env.DB.prepare("SELECT name, size, hits FROM ships WHERE game_id = ? AND owner = 'cpu'").bind(gameId).all(),
    env.DB.prepare("SELECT shooter, row, col, result FROM shots WHERE game_id = ? ORDER BY id").bind(gameId).all(),
  ]);

  const cpu = cpuShips.results || [];
  return json({
    ok: true,
    game,
    fleet: FLEET,
    player: { ships: playerShips.results || [] },
    cpu: game.status === "posicionando" ? null : {
      shipsRemaining: cpu.filter((s) => s.hits < s.size).length,
      sunk: cpu.filter((s) => s.hits >= s.size).map((s) => s.name),
    },
    shots: shots.results || [],
  });
}
