import { getSession, requireDB } from "../../_lib/auth.js";
import {
  errorResponse,
  json,
  methodNotAllowed,
  optionalLink,
  parsePostId,
  readJson,
  requireKeys,
  requiredText,
} from "../../_lib/http.js";

const POST_FIELDS = `p.id, p.course_code, p.author_id, p.author_name, p.author_avatar,
  p.title, p.body, p.link, p.created_at, p.updated_at`;

async function findPost(db, id) {
  return db.prepare(`SELECT ${POST_FIELDS} FROM posts p WHERE p.id = ?`).bind(id).first();
}

export async function onRequestGet({ request, env, params }) {
  try {
    const user = await getSession(request, env);
    const db = requireDB(env);
    const id = parsePostId(params.id);
    const post = await db.prepare(
      `SELECT ${POST_FIELDS}, COALESCE(ps.is_read, 0) AS is_read,
       COALESCE(ps.is_pinned, 0) AS is_pinned
       FROM posts p
       JOIN subscriptions s ON s.course_code = p.course_code AND s.user_id = ?
       LEFT JOIN post_states ps ON ps.post_id = p.id AND ps.user_id = ?
       WHERE p.id = ?`,
    ).bind(user.user_id, user.user_id, id).first();
    if (!post) return json({ error: "post_not_found", message: "Publicação não encontrada." }, 404);
    return json({ post });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPatch({ request, env, params }) {
  try {
    const user = await getSession(request, env);
    const payload = await readJson(request);
    requireKeys(payload, ["title", "body", "link"]);
    const id = parsePostId(params.id);
    const db = requireDB(env);
    const current = await findPost(db, id);
    if (!current) return json({ error: "post_not_found", message: "Publicação não encontrada." }, 404);
    if (current.author_id !== user.user_id) {
      return json({ error: "forbidden", message: "Somente o autor pode editar esta publicação." }, 403);
    }
    const updates = [];
    const values = [];
    if (Object.hasOwn(payload, "title")) {
      updates.push("title = ?");
      values.push(requiredText(payload.title, "title", 200));
    }
    if (Object.hasOwn(payload, "body")) {
      updates.push("body = ?");
      values.push(requiredText(payload.body, "body", 20000));
    }
    if (Object.hasOwn(payload, "link")) {
      updates.push("link = ?");
      values.push(optionalLink(payload.link));
    }
    if (!updates.length) {
      return json({ error: "invalid_payload", message: "Informe ao menos title, body ou link." }, 400);
    }
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id, user.user_id);
    await db.prepare(
      `UPDATE posts SET ${updates.join(", ")} WHERE id = ? AND author_id = ?`,
    ).bind(...values).run();
    return json({ post: await findPost(db, id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    const user = await getSession(request, env);
    const id = parsePostId(params.id);
    const db = requireDB(env);
    const current = await findPost(db, id);
    if (!current) return json({ error: "post_not_found", message: "Publicação não encontrada." }, 404);
    if (current.author_id !== user.user_id) {
      return json({ error: "forbidden", message: "Somente o autor pode excluir esta publicação." }, 403);
    }
    await db.prepare("DELETE FROM posts WHERE id = ? AND author_id = ?")
      .bind(id, user.user_id).run();
    return json({ ok: true, id });
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest({ request }) {
  return methodNotAllowed(["GET", "PATCH", "DELETE"]);
}
