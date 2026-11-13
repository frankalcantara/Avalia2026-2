import { getSession, requireDB } from "../_lib/auth.js";
import {
  errorResponse,
  json,
  methodNotAllowed,
  optionalLink,
  readJson,
  requireKeys,
  requiredCourseCode,
  requiredText,
} from "../_lib/http.js";

const POST_FIELDS = `p.id, p.course_code, p.author_id, p.author_name, p.author_avatar,
  p.title, p.body, p.link, p.created_at, p.updated_at`;

export async function onRequestGet({ request, env }) {
  try {
    const user = await getSession(request, env);
    const db = requireDB(env);
    const courseCode = new URL(request.url).searchParams.get("course_code");
    let query = `SELECT ${POST_FIELDS}, COALESCE(ps.is_read, 0) AS is_read,
      COALESCE(ps.is_pinned, 0) AS is_pinned
      FROM posts p
      JOIN subscriptions s ON s.course_code = p.course_code AND s.user_id = ?
      LEFT JOIN post_states ps ON ps.post_id = p.id AND ps.user_id = ?
      WHERE 1 = 1`;
    const params = [user.user_id, user.user_id];
    if (courseCode !== null) {
      query += " AND p.course_code = ?";
      params.push(requiredCourseCode(courseCode));
    }
    query += " ORDER BY COALESCE(ps.is_pinned, 0) DESC, p.created_at DESC, p.id DESC";
    const result = await db.prepare(query).bind(...params).all();
    return json({ posts: result.results || [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getSession(request, env);
    const payload = await readJson(request);
    requireKeys(payload, ["course_code", "title", "body", "link"]);
    const courseCode = requiredCourseCode(payload.course_code);
    const title = requiredText(payload.title, "title", 200);
    const body = requiredText(payload.body, "body", 20000);
    const link = payload.link === undefined ? null : optionalLink(payload.link);
    const db = requireDB(env);
    const subscribed = await db.prepare(
      "SELECT 1 AS subscribed FROM subscriptions WHERE user_id = ? AND course_code = ?",
    ).bind(user.user_id, courseCode).first();
    if (!subscribed) {
      return json({ error: "subscription_required", message: "Inscreva-se na disciplina para publicar nela." }, 403);
    }

    const inserted = await db.prepare(
      "INSERT INTO posts (course_code, author_id, author_name, author_avatar, title, body, link, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    ).bind(
      courseCode,
      user.user_id,
      user.username,
      user.avatar,
      title,
      body,
      link,
    ).run();
    const id = Number(inserted.meta?.last_row_id);
    const post = await db.prepare(
      `SELECT ${POST_FIELDS} FROM posts p WHERE p.id = ?`,
    ).bind(id).first();
    return json({ post }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest({ request }) {
  return methodNotAllowed(["GET", "POST"]);
}
