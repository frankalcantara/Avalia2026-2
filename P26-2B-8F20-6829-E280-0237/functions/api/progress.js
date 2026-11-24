import {
  methodNotAllowed,
  readJsonBody,
  requireSession,
} from "../_lib/api.js";
import {
  normalizeNotes,
  validateProgressBoard,
} from "../_lib/sudoku.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const { user, response } = await requireSession(request, env);
  if (response) return response;
  if (!env.DB) {
    return Response.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }

  const gameId = new URL(request.url).searchParams.get("gameId");
  if (!gameId || gameId.length > 80) {
    return Response.json({ ok: false, error: "invalid_game_id" }, { status: 400 });
  }

  try {
    const progress = await env.DB.prepare(
      "SELECT g.game_id, g.puzzle_id, p.difficulty, pr.board, pr.notes_json, pr.updated_at FROM sudoku_games g JOIN sudoku_puzzles p ON p.puzzle_id = g.puzzle_id JOIN sudoku_progress pr ON pr.game_id = g.game_id WHERE g.game_id = ? AND g.user_id = ? AND g.status = 'in_progress'"
    ).bind(gameId, user.userId).first();

    if (!progress) {
      return Response.json({ ok: false, error: "active_game_not_found" }, { status: 404 });
    }

    let notes;
    try {
      notes = JSON.parse(progress.notes_json);
    } catch (error) {
      console.error("Stored Sudoku notes are invalid JSON.", error);
      return Response.json({ ok: false, error: "stored_progress_invalid" }, { status: 500 });
    }
    if (!notes || typeof notes !== "object" || Array.isArray(notes)) {
      return Response.json({ ok: false, error: "stored_progress_invalid" }, { status: 500 });
    }

    return Response.json({
      ok: true,
      gameId: progress.game_id,
      puzzleId: progress.puzzle_id,
      difficulty: progress.difficulty,
      board: progress.board,
      notes,
      updatedAt: progress.updated_at,
    });
  } catch (error) {
    console.error("Failed to load Sudoku progress from D1.", error);
    return Response.json({ ok: false, error: "progress_lookup_failed" }, { status: 503 });
  }
}

export async function onRequestPut(context) {
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

  let puzzle;
  let gameStatus;
  try {
    const game = await env.DB.prepare(
      "SELECT g.status, p.initial_board FROM sudoku_games g JOIN sudoku_puzzles p ON p.puzzle_id = g.puzzle_id WHERE g.game_id = ? AND g.user_id = ?"
    ).bind(gameId, user.userId).first();
    if (!game) {
      return Response.json({ ok: false, error: "game_not_found" }, { status: 404 });
    }
    puzzle = { initial_board: game.initial_board };
    gameStatus = game.status;
  } catch (error) {
    console.error("Failed to authorize Sudoku progress update.", error);
    return Response.json({ ok: false, error: "progress_lookup_failed" }, { status: 503 });
  }

  if (gameStatus !== "in_progress") {
    return Response.json({ ok: false, error: "game_not_active" }, { status: 409 });
  }

  const boardError = validateProgressBoard(body.board, puzzle);
  if (boardError) {
    return Response.json({ ok: false, error: boardError }, { status: 400 });
  }
  const { notesJson, error: notesError } = normalizeNotes(body.notes, body.board);
  if (notesError) {
    return Response.json({ ok: false, error: notesError }, { status: 400 });
  }

  let saveResult;
  try {
    saveResult = await env.DB.prepare(
      "INSERT INTO sudoku_progress (game_id, board, notes_json, updated_at) SELECT ?, ?, ?, CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM sudoku_games WHERE game_id = ? AND user_id = ? AND status = 'in_progress') ON CONFLICT(game_id) DO UPDATE SET board = excluded.board, notes_json = excluded.notes_json, updated_at = CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM sudoku_games WHERE game_id = ? AND user_id = ? AND status = 'in_progress')"
    ).bind(gameId, body.board, notesJson, gameId, user.userId, gameId, user.userId).run();
  } catch (error) {
    console.error("Failed to save Sudoku progress in D1.", error);
    return Response.json({ ok: false, error: "progress_save_failed" }, { status: 503 });
  }

  if (!saveResult.meta || saveResult.meta.changes === 0) {
    return Response.json({ ok: false, error: "game_not_active" }, { status: 409 });
  }
  return Response.json({ ok: true, saved: true, gameId });
}

export function onRequest(context) {
  return methodNotAllowed("GET, PUT");
}
