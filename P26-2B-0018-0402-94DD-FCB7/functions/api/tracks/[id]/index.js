/**
 * Cloudflare Pages Function — DELETE /api/tracks/:id
 * Remove uma faixa e seus votos (permitido apenas para autor da faixa ou criador da sala).
 */
import { requireAuth } from "../../../../src/server/auth.js";
import { requireDb, runBatchStatements } from "../../../../src/server/db.js";
import { errorResponse, jsonResponse } from "../../../../src/server/http.js";

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const { db, response: dbErr } = await requireDb(env);
  if (dbErr) return dbErr;

  const { user, response: authErr } = await requireAuth(request, env);
  if (authErr) return authErr;

  const rawId = String(params?.id ?? "").trim();
  if (!/^\d+$/.test(rawId)) {
    return errorResponse("Identificador de faixa inválido.", "INVALID_TRACK_ID", 400);
  }

  const trackId = Number(rawId);

  const track = await db
    .prepare(
      `SELECT
        t.id,
        t.room_id,
        t.submitted_by,
        r.created_by AS room_created_by
      FROM tracks t
      INNER JOIN rooms r ON r.id = t.room_id
      WHERE t.id = ?
      LIMIT 1`
    )
    .bind(trackId)
    .first();

  if (!track) {
    return errorResponse("Faixa não encontrada.", "TRACK_NOT_FOUND", 404);
  }

  const isTrackAuthor = track.submitted_by === user.user_id;
  const isRoomOwner = track.room_created_by === user.user_id;

  if (!isTrackAuthor && !isRoomOwner) {
    return errorResponse(
      "Apenas quem enviou a faixa ou o criador da sala pode removê-la.",
      "FORBIDDEN",
      403
    );
  }

  // Limpeza explícita dos votos antes de remover a faixa para garantir integridade no D1.
  await runBatchStatements(db, [
    db.prepare("DELETE FROM track_votes WHERE track_id = ?").bind(trackId),
    db.prepare("DELETE FROM tracks WHERE id = ?").bind(trackId),
  ]);

  return jsonResponse({
    ok: true,
    deletedTrackId: trackId,
  });
}
