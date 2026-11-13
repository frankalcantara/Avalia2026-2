/**
 * POST /api/games/:id/shoot   body: { row, col }
 * Processa o tiro do jogador no servidor, responde o computador e devolve APENAS
 * "agua" | "acerto" | "afundado" (a matriz do adversário nunca sai daqui).
 */
import { json, fail, requireUser, parseGameId } from "../../../_lib/http.js";
import { BOARD_SIZE, resolveShot, pickCpuShot } from "../../../_lib/game.js";

const isCoord = (n) => Number.isInteger(n) && n >= 0 && n < BOARD_SIZE;

export async function onRequestPost(context) {
  const { env, request, params } = context;
  const auth = await requireUser(context);
  if (auth.response) return auth.response;
  const userId = auth.user.userId;

  const gameId = parseGameId(params);
  if (!gameId) return fail(400, "Partida inválida.");

  const body = await request.json().catch(() => null);
  if (!isCoord(body?.row) || !isCoord(body?.col)) {
    return fail(400, `Coordenadas inválidas (use inteiros de 0 a ${BOARD_SIZE - 1}).`);
  }
  const { row, col } = body;

  const game = await env.DB.prepare("SELECT id, status, turn FROM games WHERE id = ? AND user_id = ?")
    .bind(gameId, userId).first();
  if (!game) return fail(404, "Partida não encontrada.");
  if (game.status !== "em_combate") return fail(409, "Esta partida não está em combate.");
  if (game.turn !== "player") return fail(409, "Não é a sua vez.");

  const [shipsRes, shotsRes] = await Promise.all([
    env.DB.prepare("SELECT id, owner, name, size, row, col, orientation, hits FROM ships WHERE game_id = ?").bind(gameId).all(),
    env.DB.prepare("SELECT shooter, row, col FROM shots WHERE game_id = ?").bind(gameId).all(),
  ]);
  const cpuShips = shipsRes.results.filter((s) => s.owner === "cpu");
  const playerShips = shipsRes.results.filter((s) => s.owner === "player");
  const shots = shotsRes.results;

  if (shots.some((s) => s.shooter === "player" && s.row === row && s.col === col)) {
    return fail(409, "Você já atirou nessa posição.");
  }

  const insertShot = env.DB.prepare(
    "INSERT INTO shots (game_id, shooter, row, col, result, ship_id) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const addHit = env.DB.prepare("UPDATE ships SET hits = hits + 1 WHERE id = ?");
  const stmts = [];

  // 1) tiro do jogador
  const mine = resolveShot(cpuShips, row, col);
  stmts.push(insertShot.bind(gameId, "player", row, col, mine.result, mine.ship?.id ?? null));
  if (mine.ship) { stmts.push(addHit.bind(mine.ship.id)); mine.ship.hits += 1; }

  let winner = null;
  let cpuShot = null;
  if (cpuShips.every((s) => s.hits >= s.size)) {
    winner = "player";
  } else {
    // 2) resposta do computador
    const taken = new Set(shots.filter((s) => s.shooter === "cpu").map((s) => `${s.row},${s.col}`));
    const [cr, cc] = pickCpuShot(taken, playerShips);
    const theirs = resolveShot(playerShips, cr, cc);
    stmts.push(insertShot.bind(gameId, "cpu", cr, cc, theirs.result, theirs.ship?.id ?? null));
    if (theirs.ship) { stmts.push(addHit.bind(theirs.ship.id)); theirs.ship.hits += 1; }
    cpuShot = { row: cr, col: cc, result: theirs.result, ship: theirs.result === "afundado" ? theirs.ship.name : null };
    if (playerShips.every((s) => s.hits >= s.size)) winner = "cpu";
  }

  if (winner) {
    const win = winner === "player" ? 1 : 0;
    stmts.push(env.DB.prepare(
      "UPDATE games SET status = 'finalizada', winner = ?, finished_at = datetime('now') WHERE id = ? AND status = 'em_combate'"
    ).bind(winner, gameId));
    stmts.push(env.DB.prepare(
      `INSERT INTO scores (user_id, games_played, wins, losses, updated_at) VALUES (?, 1, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET games_played = games_played + 1, wins = wins + excluded.wins,
         losses = losses + excluded.losses, updated_at = datetime('now')`
    ).bind(userId, win, 1 - win));
  }

  try {
    // Atômico: se dois tiros iguais chegarem juntos, a restrição UNIQUE derruba o segundo inteiro.
    await env.DB.batch(stmts);
  } catch (err) {
    console.error("shoot batch failed", err);
    return fail(409, "Tiro já processado. Atualize a partida.");
  }

  return json({
    ok: true,
    shot: { row, col, result: mine.result, ship: mine.result === "afundado" ? mine.ship.name : null },
    cpuShot,
    game: { id: gameId, status: winner ? "finalizada" : "em_combate", turn: "player", winner },
  });
}
