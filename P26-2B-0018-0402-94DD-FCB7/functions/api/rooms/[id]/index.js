/**
 * Cloudflare Pages Function — /api/rooms/:id
 * GET: detalha a sala (por id ou slug) e retorna sua fila ordenada por saldo de votos no D1.
 * DELETE: remove a sala e todos os seus votos/faixas (apenas criador da sala).
 */
import { getSessionUser, requireAuth } from "../../../../src/server/auth.js";
import { findRoomByIdOrSlug, requireDb, runBatchStatements } from "../../../../src/server/db.js";
import { errorResponse, jsonResponse } from "../../../../src/server/http.js";

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const { db, response: dbErr } = await requireDb(env);
  if (dbErr) return dbErr;

  const roomRow = await findRoomByIdOrSlug(db, params?.id);
  if (!roomRow) {
    return errorResponse("Sala não encontrada.", "ROOM_NOT_FOUND", 404);
  }

  const sessionUser = await getSessionUser(request, env);
  const viewerId = sessionUser ? sessionUser.user_id : "";

  const tracksRes = await db
    .prepare(
      `SELECT
        t.id,
        t.room_id,
        t.title,
        t.artist,
        t.genre,
        t.url,
        t.normalized_url,
        t.provider,
        t.embed_url,
        t.submitted_by,
        t.created_at,
        u.username AS author_username,
        u.avatar AS author_avatar,
        COALESCE(SUM(tv.value), 0) AS score,
        COALESCE(SUM(CASE WHEN tv.value = 1 THEN 1 ELSE 0 END), 0) AS upvotes,
        COALESCE(SUM(CASE WHEN tv.value = -1 THEN 1 ELSE 0 END), 0) AS downvotes,
        COALESCE(MAX(CASE WHEN tv.user_id = ? THEN tv.value ELSE NULL END), 0) AS user_vote
      FROM tracks t
      LEFT JOIN discord_users u ON u.user_id = t.submitted_by
      LEFT JOIN track_votes tv ON tv.track_id = t.id
      WHERE t.room_id = ?
      GROUP BY t.id
      ORDER BY score DESC, upvotes DESC, t.created_at ASC, t.id ASC`
    )
    .bind(viewerId, Number(roomRow.id))
    .all();

  const tracks = (tracksRes.results || []).map((row) => ({
    id: Number(row.id),
    room_id: Number(row.room_id),
    title: row.title,
    artist: row.artist || "",
    genre: row.genre,
    url: row.url,
    normalized_url: row.normalized_url,
    provider: row.provider,
    embed_url: row.embed_url,
    submitted_by: row.submitted_by,
    created_at: row.created_at,
    author_username: row.author_username || "Usuário Discord",
    author_avatar: row.author_avatar ?? null,
    score: Number(row.score || 0),
    upvotes: Number(row.upvotes || 0),
    downvotes: Number(row.downvotes || 0),
    user_vote: Number(row.user_vote || 0),
  }));

  const totalVotes = tracks.reduce((acc, item) => acc + item.upvotes + item.downvotes, 0);

  return jsonResponse({
    ok: true,
    room: {
      id: Number(roomRow.id),
      slug: roomRow.slug,
      name: roomRow.name,
      description: roomRow.description || "",
      theme_tag: roomRow.theme_tag || "Foco & Código",
      created_by: roomRow.created_by,
      created_at: roomRow.created_at,
      creator_username: roomRow.creator_username || "Usuário Discord",
      creator_avatar: roomRow.creator_avatar ?? null,
      track_count: tracks.length,
      total_votes: totalVotes,
    },
    tracks,
  });
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const { db, response: dbErr } = await requireDb(env);
  if (dbErr) return dbErr;

  const { user, response: authErr } = await requireAuth(request, env);
  if (authErr) return authErr;

  const roomRow = await findRoomByIdOrSlug(db, params?.id);
  if (!roomRow) {
    return errorResponse("Sala não encontrada.", "ROOM_NOT_FOUND", 404);
  }

  if (roomRow.created_by !== user.user_id) {
    return errorResponse(
      "Apenas o criador da sala tem permissão para excluí-la.",
      "FORBIDDEN",
      403
    );
  }

  const roomId = Number(roomRow.id);

  // Limpeza explícita de registros dependentes para garantir integridade mesmo se PRAGMA foreign_keys estiver OFF.
  await runBatchStatements(db, [
    db
      .prepare(
        "DELETE FROM track_votes WHERE track_id IN (SELECT id FROM tracks WHERE room_id = ?)"
      )
      .bind(roomId),
    db.prepare("DELETE FROM tracks WHERE room_id = ?").bind(roomId),
    db.prepare("DELETE FROM rooms WHERE id = ?").bind(roomId),
  ]);

  return jsonResponse({
    ok: true,
    deletedRoomId: roomId,
  });
}
