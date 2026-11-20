import { randomHex } from "./random.js";
import { canViewRoom } from "./rooms.js";
import { parseTags } from "./tags.js";

// Slug de URL: 16 bytes aleatórios em hex (128 bits), não enumerável.
export const SLUG_PATTERN = /^[a-f0-9]{32}$/;

export const generateSlug = () => randomHex(16);

// Projeção compartilhada pelas consultas de lista e de artigo individual.
export const ARTICLE_FIELDS = `
  a.id, a.slug, a.title, a.body, a.author_id, a.room_id, a.created_at, a.updated_at,
  u.username AS author_name, u.avatar AS author_avatar,
  r.name AS room_name, r.visibility AS room_visibility,
  (SELECT COUNT(*) FROM article_likes l WHERE l.article_id = a.id) AS like_count,
  (SELECT COUNT(*) FROM comments c WHERE c.article_id = a.id) AS comment_count,
  (SELECT GROUP_CONCAT(t.tag, ',') FROM article_tags t WHERE t.article_id = a.id) AS tags,
  EXISTS (SELECT 1 FROM article_likes mine WHERE mine.article_id = a.id AND mine.user_id = ?) AS liked
`;

export function parseArticleInput(body) {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.body === "string" ? body.body.trim() : "";
  const rawRoomId = body?.roomId;
  const roomId = rawRoomId === "" || rawRoomId == null ? null : Number(rawRoomId);
  const parsedTags = parseTags(body?.tags);

  if (title.length < 3 || title.length > 140) return { error: "O título deve ter entre 3 e 140 caracteres." };
  if (content.length < 1 || content.length > 50000) return { error: "O artigo deve ter entre 1 e 50.000 caracteres." };
  if (roomId !== null && (!Number.isSafeInteger(roomId) || roomId < 1)) return { error: "Sala inválida." };
  if (parsedTags.error) return { error: parsedTags.error };
  return { title, body: content, roomId, tags: parsedTags.tags };
}

export function findArticle(db, articleId) {
  return db.prepare("SELECT id, room_id, author_id FROM articles WHERE id = ?").bind(articleId).first();
}

export function findArticleBySlug(db, slug) {
  return db.prepare("SELECT id, room_id, author_id FROM articles WHERE slug = ?").bind(slug).first();
}

export function findArticleForRevision(db, articleId) {
  return db.prepare("SELECT id, title, body, room_id FROM articles WHERE id = ?").bind(articleId).first();
}

export async function canViewArticle(db, article, userId) {
  return !article.room_id || canViewRoom(db, article.room_id, userId);
}
