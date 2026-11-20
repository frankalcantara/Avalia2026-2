import { methodNotAllowed, readJsonBody, requireSession } from "../../_lib/api.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, response } = await requireSession(request, env);
  if (response) return response;
  if (!env.DB) {
    return Response.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }

  const { body, response: bodyError } = await readJsonBody(request);
  if (bodyError) return bodyError;
  if (!["facil", "medio", "dificil"].includes(body.difficulty)) {
    return Response.json({ ok: false, error: "invalid_difficulty" }, { status: 400 });
  }

  let puzzle;
  try {
    puzzle = await env.DB.prepare(
      "SELECT puzzle_id, difficulty, initial_board FROM sudoku_puzzles WHERE difficulty = ? ORDER BY puzzle_id LIMIT 1"
    ).bind(body.difficulty).first();
  } catch (error) {
    console.error("Failed to load Sudoku puzzle from D1.", error);
    return Response.json({ ok: false, error: "puzzle_lookup_failed" }, { status: 503 });
  }
  if (!puzzle) {
    return Response.json({ ok: false, error: "puzzle_not_found" }, { status: 404 });
  }

  const gameId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO sudoku_games (game_id, user_id, puzzle_id, status, started_at) VALUES (?, ?, ?, 'in_progress', ?)"
      ).bind(gameId, user.userId, puzzle.puzzle_id, startedAt),
      env.DB.prepare(
        "INSERT INTO sudoku_progress (game_id, board, notes_json, updated_at) VALUES (?, ?, '{}', ?)"
      ).bind(gameId, puzzle.initial_board, startedAt),
    ]);
  } catch (error) {
    console.error("Failed to create Sudoku game in D1.", error);
    return Response.json({ ok: false, error: "game_creation_failed" }, { status: 503 });
  }

  return Response.json({
    ok: true,
    gameId,
    puzzleId: puzzle.puzzle_id,
    difficulty: puzzle.difficulty,
    board: puzzle.initial_board,
    startedAt,
  }, { status: 201 });
}

export function onRequest(context) {
  return methodNotAllowed("POST");
}
