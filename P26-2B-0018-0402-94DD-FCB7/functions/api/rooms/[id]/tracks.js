/**
 * Cloudflare Pages Function — POST /api/rooms/:id/tracks
 * Adiciona uma faixa validada (YouTube, Spotify ou SoundCloud) à fila da sala.
 */
import { requireAuth } from "../../../../src/server/auth.js";
import { findRoomByIdOrSlug, requireDb } from "../../../../src/server/db.js";
import { errorResponse, jsonResponse, parseJsonBody } from "../../../../src/server/http.js";
import { validateTrackInput } from "../../../../src/server/validators.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const { db, response: dbErr } = await requireDb(env);
  if (dbErr) return dbErr;

  const { user, response: authErr } = await requireAuth(request, env);
  if (authErr) return authErr;

  const roomRow = await findRoomByIdOrSlug(db, params?.id);
  if (!roomRow) {
    return errorResponse("Sala não encontrada.", "ROOM_NOT_FOUND", 404);
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return errorResponse(parsed.error, "INVALID_JSON", 400);
  }

  const validation = validateTrackInput(parsed.data);
  if (!validation.valid) {
    return errorResponse(validation.error, "VALIDATION_ERROR", 400);
  }

  const roomId = Number(roomRow.id);
  const { title, artist, genre, url, provider, normalizedUrl, embedUrl } = validation.value;

  const duplicate = await db
    .prepare("SELECT id FROM tracks WHERE room_id = ? AND normalized_url = ? LIMIT 1")
    .bind(roomId, normalizedUrl)
    .first();

  if (duplicate) {
    return errorResponse(
      "Esta faixa já foi adicionada a esta sala.",
      "DUPLICATE_TRACK",
      409
    );
  }

  try {
    await db
      .prepare(
        `INSERT INTO tracks (
          room_id, title, artist, genre, url, normalized_url, provider, embed_url, submitted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        roomId,
        title,
        artist,
        genre,
        url,
        normalizedUrl,
        provider,
        embedUrl,
        user.user_id
      )
      .run();
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.toUpperCase().includes("UNIQUE")) {
      return errorResponse(
        "Esta faixa já foi adicionada a esta sala.",
        "DUPLICATE_TRACK",
        409
      );
    }
    return errorResponse("Não foi possível salvar a faixa na fila.", "DB_WRITE_ERROR", 500);
  }

  const created = await db
    .prepare(
      `SELECT id, room_id, title, artist, genre, url, normalized_url, provider, embed_url, submitted_by, created_at
       FROM tracks
       WHERE room_id = ? AND normalized_url = ?
       LIMIT 1`
    )
    .bind(roomId, normalizedUrl)
    .first();

  return jsonResponse(
    {
      ok: true,
      track: {
        id: Number(created.id),
        room_id: Number(created.room_id),
        title: created.title,
        artist: created.artist || "",
        genre: created.genre,
        url: created.url,
        normalized_url: created.normalized_url,
        provider: created.provider,
        embed_url: created.embed_url,
        submitted_by: created.submitted_by,
        created_at: created.created_at,
        score: 0,
        upvotes: 0,
        downvotes: 0,
        user_vote: 0,
        author_username: user.username,
        author_avatar: user.avatar ?? null,
      },
    },
    201
  );
}
