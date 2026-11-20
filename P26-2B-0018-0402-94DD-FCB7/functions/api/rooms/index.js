/**
 * Cloudflare Pages Function — /api/rooms
 * GET: lista salas públicas com métricas agregadas e filtro opcional ?q=...
 * POST: cria uma nova sala colaborativa (exige sessão Discord autenticada no D1).
 */
import { generateSecureToken, requireAuth } from "../../../src/server/auth.js";
import { requireDb } from "../../../src/server/db.js";
import { errorResponse, jsonResponse, parseJsonBody } from "../../../src/server/http.js";
import { slugifyRoomName, validateRoomInput } from "../../../src/server/validators.js";

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function generateUniqueSlug(db, name) {
  const base = slugifyRoomName(name);
  let candidate = base;

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const existing = await db
      .prepare("SELECT id FROM rooms WHERE slug = ? LIMIT 1")
      .bind(candidate)
      .first();
    if (!existing) {
      return candidate;
    }
    candidate = `${base}-${attempt + 1}`;
  }

  return `${base}-${generateSecureToken(3)}`;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const { db, response: dbErr } = await requireDb(env);
  if (dbErr) return dbErr;

  const url = new URL(request.url);
  const queryText = (url.searchParams.get("q") || "").trim().slice(0, 100);

  const baseQuery = `
    SELECT
      r.id,
      r.slug,
      r.name,
      r.description,
      r.theme_tag,
      r.created_by,
      r.created_at,
      u.username AS creator_username,
      u.avatar AS creator_avatar,
      (SELECT COUNT(*) FROM tracks t WHERE t.room_id = r.id) AS track_count,
      (
        SELECT COUNT(*)
        FROM track_votes tv
        INNER JOIN tracks t ON t.id = tv.track_id
        WHERE t.room_id = r.id
      ) AS total_votes,
      (
        SELECT t2.title
        FROM tracks t2
        LEFT JOIN track_votes tv2 ON tv2.track_id = t2.id
        WHERE t2.room_id = r.id
        GROUP BY t2.id
        ORDER BY
          COALESCE(SUM(tv2.value), 0) DESC,
          COALESCE(SUM(CASE WHEN tv2.value = 1 THEN 1 ELSE 0 END), 0) DESC,
          t2.created_at ASC,
          t2.id ASC
        LIMIT 1
      ) AS top_track_title
    FROM rooms r
    LEFT JOIN discord_users u ON u.user_id = r.created_by
  `;

  let res;
  if (queryText) {
    const pattern = `%${escapeLikePattern(queryText)}%`;
    res = await db
      .prepare(
        `${baseQuery}
         WHERE r.name LIKE ? ESCAPE '\\'
            OR r.description LIKE ? ESCAPE '\\'
            OR r.theme_tag LIKE ? ESCAPE '\\'
         ORDER BY r.created_at DESC, r.id DESC`
      )
      .bind(pattern, pattern, pattern)
      .all();
  } else {
    res = await db
      .prepare(`${baseQuery} ORDER BY r.created_at DESC, r.id DESC`)
      .all();
  }

  const rooms = (res.results || []).map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description || "",
    theme_tag: row.theme_tag || "Foco & Código",
    created_by: row.created_by,
    created_at: row.created_at,
    creator_username: row.creator_username || "Usuário Discord",
    creator_avatar: row.creator_avatar ?? null,
    track_count: Number(row.track_count || 0),
    total_votes: Number(row.total_votes || 0),
    top_track_title: row.top_track_title ?? null,
  }));

  return jsonResponse({ ok: true, rooms });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { db, response: dbErr } = await requireDb(env);
  if (dbErr) return dbErr;

  const { user, response: authErr } = await requireAuth(request, env);
  if (authErr) return authErr;

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return errorResponse(parsed.error, "INVALID_JSON", 400);
  }

  const validation = validateRoomInput(parsed.data);
  if (!validation.valid) {
    return errorResponse(validation.error, "VALIDATION_ERROR", 400);
  }

  const { name, description, theme_tag } = validation.value;
  const slug = await generateUniqueSlug(db, name);

  await db
    .prepare(
      `INSERT INTO rooms (slug, name, description, theme_tag, created_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(slug, name, description, theme_tag, user.user_id)
    .run();

  const created = await db
    .prepare(
      `SELECT id, slug, name, description, theme_tag, created_by, created_at
       FROM rooms
       WHERE slug = ?
       LIMIT 1`
    )
    .bind(slug)
    .first();

  return jsonResponse(
    {
      ok: true,
      room: {
        id: Number(created.id),
        slug: created.slug,
        name: created.name,
        description: created.description || "",
        theme_tag: created.theme_tag,
        created_by: created.created_by,
        created_at: created.created_at,
        creator_username: user.username,
        creator_avatar: user.avatar ?? null,
        track_count: 0,
        total_votes: 0,
        top_track_title: null,
      },
    },
    201
  );
}
