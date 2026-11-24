import {
  methodNotAllowed,
  readJsonBody,
  requireSession,
} from "../../_lib/api.js";
import {
  MIN_GAME_DURATION_SECONDS,
  validateSolvedBoard,
} from "../../_lib/sudoku.js";

async function findExistingResult(db, gameId) {
  return db.prepare(
    "SELECT elapsed_seconds, completed_at FROM sudoku_results WHERE game_id = ?"
  ).bind(gameId).first();
}

function resultResponse(result, status) {
  return Response.json({
    ok: true,
    completed: true,
    elapsedSeconds: Number(result.elapsed_seconds),
    completedAt: result.completed_at,
  }, { status });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, response } = await requireSession(request, env);
  if (response) return response;
  if (!env.DB) {
    return Response.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }

  const { body, response: bodyError } = await readJsonBody(request);
  if (bodyError) return bodyError;
  const gameId = typeof body.gameId === "string" ? body.gameId : "";
  if (!gameId || gameId.length > 80) {
    return Response.json({ ok: false, error: "invalid_game_id" }, { status: 400 });
  }

  let game;
  try {
    game = await env.DB.prepare(
      "SELECT g.game_id, g.status, g.started_at, p.puzzle_id, p.initial_board, p.solution FROM sudoku_games g JOIN sudoku_puzzles p ON p.puzzle_id = g.puzzle_id WHERE g.game_id = ? AND g.user_id = ?"
    ).bind(gameId, user.userId).first();
  } catch (error) {
    console.error("Failed to load Sudoku game for validation.", error);
    return Response.json({ ok: false, error: "game_lookup_failed" }, { status: 503 });
  }
  if (!game) {
    return Response.json({ ok: false, error: "game_not_found" }, { status: 404 });
  }
  if (game.status === "completed") {
    try {
      const existingResult = await findExistingResult(env.DB, gameId);
      if (existingResult) return resultResponse(existingResult, 200);
    } catch (error) {
      console.error("Failed to load existing Sudoku result.", error);
      return Response.json({ ok: false, error: "result_lookup_failed" }, { status: 503 });
    }
    return Response.json({ ok: false, error: "completed_result_missing" }, { status: 409 });
  }
  if (game.status !== "in_progress") {
    return Response.json({ ok: false, error: "game_not_active" }, { status: 409 });
  }

  const validationError = validateSolvedBoard(body.board, game);
  if (validationError) {
    return Response.json({ ok: false, error: validationError }, { status: 400 });
  }

  const startedAt = Date.parse(game.started_at);
  const completedAtMilliseconds = Date.now();
  const elapsedMilliseconds = completedAtMilliseconds - startedAt;
  if (!Number.isFinite(startedAt) || elapsedMilliseconds < 0) {
    return Response.json({ ok: false, error: "invalid_game_start_time" }, { status: 500 });
  }
  if (elapsedMilliseconds < MIN_GAME_DURATION_SECONDS * 1000) {
    return Response.json({
      ok: false,
      error: "game_too_fast",
      minimumDurationSeconds: MIN_GAME_DURATION_SECONDS,
    }, { status: 422 });
  }
  const completedAt = new Date(completedAtMilliseconds).toISOString();
  const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);

  let batchResults;
  try {
    batchResults = await env.DB.batch([
      env.DB.prepare(
        "UPDATE sudoku_games SET status = 'completed', finished_at = ? WHERE game_id = ? AND user_id = ? AND status = 'in_progress'"
      ).bind(completedAt, gameId, user.userId),
      env.DB.prepare(
        "INSERT INTO sudoku_results (game_id, elapsed_seconds, username_snapshot, completed_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM sudoku_games WHERE game_id = ? AND user_id = ? AND status = 'completed' AND finished_at = ?) ON CONFLICT(game_id) DO NOTHING"
      ).bind(gameId, elapsedSeconds, user.username, completedAt, gameId, user.userId, completedAt),
    ]);
  } catch (error) {
    console.error("Failed to complete Sudoku game in D1.", error);
    return Response.json({ ok: false, error: "result_persistence_failed" }, { status: 503 });
  }

  if (!batchResults[0].meta || batchResults[0].meta.changes === 0) {
    try {
      const existingResult = await findExistingResult(env.DB, gameId);
      if (existingResult) return resultResponse(existingResult, 200);
    } catch (error) {
      console.error("Failed to check concurrent Sudoku result.", error);
      return Response.json({ ok: false, error: "result_lookup_failed" }, { status: 503 });
    }
    return Response.json({ ok: false, error: "game_not_active" }, { status: 409 });
  }

  if (!batchResults[1].meta || batchResults[1].meta.changes === 0) {
    return Response.json({ ok: false, error: "result_persistence_failed" }, { status: 503 });
  }

  return resultResponse({ elapsed_seconds: elapsedSeconds, completed_at: completedAt }, 201);
}

export function onRequest(context) {
  return methodNotAllowed("POST");
}
