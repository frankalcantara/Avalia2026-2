/**
 * Cloudflare Pages Function — POST /api/tracks/:id/vote
 * Registra, alterna (+1 / -1) ou remove (0) o voto único do usuário autenticado na faixa
 * e recalcula o saldo diretamente no Cloudflare D1.
 */
import { requireAuth } from "../../../../src/server/auth.js";
import { requireDb } from "../../../../src/server/db.js";
import { errorResponse, jsonResponse, parseJsonBody } from "../../../../src/server/http.js";
import { validateVoteValue } from "../../../../src/server/validators.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const { db, response: dbErr } = await requireDb(env);
  if (dbErr) return dbErr;

  const { user, response: authErr } = await requireAuth(request, env);
  if (authErr) return authErr;

  const rawId = String(params?.id ?? "").trim();
  if (!/^\d+$/.test(rawId)) {
    return errorResponse("Identificador de faixa inválido.", "INVALID_TRACK_ID", 400);
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return errorResponse(parsed.error, "INVALID_JSON", 400);
  }

  const validation = validateVoteValue(parsed.data);
  if (!validation.valid) {
    return errorResponse(validation.error, "VALIDATION_ERROR", 400);
  }

  const trackId = Number(rawId);
  const voteValue = validation.value;

  const track = await db
    .prepare("SELECT id, room_id FROM tracks WHERE id = ? LIMIT 1")
    .bind(trackId)
    .first();

  if (!track) {
    return errorResponse("Faixa não encontrada.", "TRACK_NOT_FOUND", 404);
  }

  if (voteValue === 0) {
    await db
      .prepare("DELETE FROM track_votes WHERE track_id = ? AND user_id = ?")
      .bind(trackId, user.user_id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO track_votes (track_id, user_id, value, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(track_id, user_id) DO UPDATE SET
           value = excluded.value,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(trackId, user.user_id, voteValue)
      .run();
  }

  const stats = await db
    .prepare(
      `SELECT
        COALESCE(SUM(value), 0) AS score,
        COALESCE(SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END), 0) AS upvotes,
        COALESCE(SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END), 0) AS downvotes
      FROM track_votes
      WHERE track_id = ?`
    )
    .bind(trackId)
    .first();

  return jsonResponse({
    ok: true,
    track_id: Number(track.id),
    room_id: Number(track.room_id),
    score: Number(stats?.score || 0),
    upvotes: Number(stats?.upvotes || 0),
    downvotes: Number(stats?.downvotes || 0),
    user_vote: voteValue,
  });
}
