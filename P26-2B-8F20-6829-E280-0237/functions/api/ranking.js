import { methodNotAllowed } from "../_lib/api.js";
import { MIN_GAME_DURATION_SECONDS } from "../_lib/sudoku.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) {
    return Response.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }

  const url = new URL(request.url);
  const puzzleId = url.searchParams.get("puzzleId");
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? 10 : Number(rawLimit);
  if (!puzzleId || puzzleId.length > 80) {
    return Response.json({ ok: false, error: "invalid_puzzle_id" }, { status: 400 });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return Response.json({ ok: false, error: "invalid_limit" }, { status: 400 });
  }

  try {
    const puzzle = await env.DB.prepare(
      "SELECT puzzle_id, difficulty FROM sudoku_puzzles WHERE puzzle_id = ?"
    ).bind(puzzleId).first();
    if (!puzzle) {
      return Response.json({ ok: false, error: "puzzle_not_found" }, { status: 404 });
    }

    const result = await env.DB.prepare(
      "SELECT r.username_snapshot AS username, r.elapsed_seconds AS elapsedSeconds, r.completed_at AS completedAt FROM sudoku_results r JOIN sudoku_games g ON g.game_id = r.game_id WHERE g.puzzle_id = ? AND g.status = 'completed' AND r.elapsed_seconds >= ? ORDER BY r.elapsed_seconds ASC, r.completed_at ASC, r.game_id ASC LIMIT ?"
    ).bind(puzzleId, MIN_GAME_DURATION_SECONDS, limit).all();
    const entries = (result.results || []).map((entry, index) => ({
      rank: index + 1,
      username: entry.username,
      elapsedSeconds: Number(entry.elapsedSeconds),
      completedAt: entry.completedAt,
    }));

    return Response.json({
      ok: true,
      puzzleId: puzzle.puzzle_id,
      difficulty: puzzle.difficulty,
      entries,
    });
  } catch (error) {
    console.error("Failed to load Sudoku ranking from D1.", error);
    return Response.json({ ok: false, error: "ranking_lookup_failed" }, { status: 503 });
  }
}

export function onRequest(context) {
  return methodNotAllowed("GET");
}
