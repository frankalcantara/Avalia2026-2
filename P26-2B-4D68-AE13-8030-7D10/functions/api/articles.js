import { ARTICLE_FIELDS, generateSlug, parseArticleInput } from "../_lib/articles.js";
import { errorResponse, isSameOrigin, json, readJson, requireDatabase } from "../_lib/http.js";
import { canViewRoom } from "../_lib/rooms.js";
import { getSession } from "../_lib/session.js";
import { TAG_PATTERN, replaceTags } from "../_lib/tags.js";
import { isPositiveId } from "../_lib/validation.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const LIST_QUERY = `
  SELECT ${ARTICLE_FIELDS}
  FROM articles a
  JOIN discord_users u ON u.user_id = a.author_id
  LEFT JOIN rooms r ON r.id = a.room_id
  WHERE %CONDITIONS%
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT ?
`;

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

async function parseFilters(db, url, viewer) {
  const conditions = [];
  const values = [];

  if (url.searchParams.has("author")) {
    const authorId = url.searchParams.get("author");
    if (!authorId || authorId.length > 64) return { error: "Autor inválido." };
    conditions.push("a.author_id = ?");
    values.push(authorId);
  }

  if (url.searchParams.has("room")) {
    const roomId = Number(url.searchParams.get("room"));
    if (!Number.isSafeInteger(roomId) || roomId < 1) return { error: "Sala inválida." };
    if (!await canViewRoom(db, roomId, viewer)) return { status: 404, error: "Sala não encontrada." };
    conditions.push("a.room_id = ?");
    values.push(roomId);
  } else {
    conditions.push(`(a.room_id IS NULL
      OR EXISTS (SELECT 1 FROM rooms visible_room WHERE visible_room.id = a.room_id AND visible_room.visibility = 'public')
      OR EXISTS (SELECT 1 FROM room_members member WHERE member.room_id = a.room_id AND member.user_id = ?))`);
    values.push(viewer);
  }

  const search = (url.searchParams.get("q") || "").trim();
  if (search) {
    if (search.length < 2 || search.length > 80) return { error: "Busque por 2 a 80 caracteres." };
    const term = `%${escapeLike(search)}%`;
    conditions.push("(a.title LIKE ? ESCAPE '\\' OR a.body LIKE ? ESCAPE '\\')");
    values.push(term, term);
  }

  if (url.searchParams.has("tag")) {
    const tag = url.searchParams.get("tag");
    if (!TAG_PATTERN.test(String(tag))) return { error: "Etiqueta inválida." };
    conditions.push("EXISTS (SELECT 1 FROM article_tags tagged WHERE tagged.article_id = a.id AND tagged.tag = ?)");
    values.push(tag);
  }

  if (url.searchParams.has("cursor")) {
    const cursor = url.searchParams.get("cursor");
    if (!isPositiveId(cursor)) return { error: "Paginação inválida." };
    conditions.push("(a.created_at, a.id) < (SELECT created_at, id FROM articles WHERE id = ?)");
    values.push(Number(cursor));
  }

  return { conditions, values };
}

export async function onRequestGet({ request, env }) {
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const session = await getSession(request, env.SESSION_SECRET);
  const viewer = session?.userId || "";
  const url = new URL(request.url);
  const filters = await parseFilters(env.DB, url, viewer);
  if (filters.error) return errorResponse(filters.error, filters.status);

  const requested = Number(url.searchParams.get("limit") || DEFAULT_PAGE_SIZE);
  const limit = Number.isSafeInteger(requested) && requested > 0
    ? Math.min(requested, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  const result = await env.DB.prepare(LIST_QUERY.replace("%CONDITIONS%", filters.conditions.join(" AND ")))
    .bind(viewer, ...filters.values, limit + 1)
    .all();

  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const articles = hasMore ? rows.slice(0, limit) : rows;
  return json({
    articles,
    hasMore,
    nextCursor: hasMore ? articles[articles.length - 1].id : null,
  });
}

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const user = await getSession(request, env.SESSION_SECRET);
  if (!user) return errorResponse("Entre com Discord para publicar.", 401);

  const input = parseArticleInput(await readJson(request));
  if (input.error) return errorResponse(input.error);
  if (input.roomId !== null && !await canViewRoom(env.DB, input.roomId, user.userId)) {
    return errorResponse("Você não participa desta sala.", 403);
  }

  const slug = generateSlug();
  const result = await env.DB.prepare(
    "INSERT INTO articles (author_id, title, body, room_id, slug) VALUES (?, ?, ?, ?, ?)",
  ).bind(user.userId, input.title, input.body, input.roomId, slug).run();

  const articleId = result.meta.last_row_id;
  await replaceTags(env.DB, articleId, input.tags);
  return json({ ok: true, id: articleId }, 201);
}
