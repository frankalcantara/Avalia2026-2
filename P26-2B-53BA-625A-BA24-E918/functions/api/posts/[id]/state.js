import { getSession, requireDB } from "../../../_lib/auth.js";
import {
  errorResponse,
  json,
  methodNotAllowed,
  parsePostId,
  readJson,
  requireKeys,
} from "../../../_lib/http.js";

export async function onRequestPatch({ request, env, params }) {
  try {
    const user = await getSession(request, env);
    const payload = await readJson(request);
    requireKeys(payload, ["is_read", "is_pinned"]);
    const fields = ["is_read", "is_pinned"].filter((field) => Object.hasOwn(payload, field));
    if (!fields.length || fields.some((field) => typeof payload[field] !== "boolean")) {
      return json(
        { error: "invalid_payload", message: "Informe is_read e/ou is_pinned como boolean." },
        400,
      );
    }

    const id = parsePostId(params.id);
    const db = requireDB(env);
    const post = await db.prepare(
      "SELECT p.id FROM posts p JOIN subscriptions s ON s.course_code = p.course_code AND s.user_id = ? WHERE p.id = ?",
    ).bind(user.user_id, id).first();
    if (!post) return json({ error: "post_not_found", message: "Publicação não encontrada no seu feed." }, 404);

    const isRead = Object.hasOwn(payload, "is_read") ? Number(payload.is_read) : null;
    const isPinned = Object.hasOwn(payload, "is_pinned") ? Number(payload.is_pinned) : null;
    await db.prepare(
      `INSERT INTO post_states (post_id, user_id, is_read, is_pinned, updated_at)
       VALUES (?, ?, COALESCE(?, 0), COALESCE(?, 0), CURRENT_TIMESTAMP)
       ON CONFLICT(post_id, user_id) DO UPDATE SET
         is_read = CASE WHEN ? IS NULL THEN post_states.is_read ELSE excluded.is_read END,
         is_pinned = CASE WHEN ? IS NULL THEN post_states.is_pinned ELSE excluded.is_pinned END,
         updated_at = CURRENT_TIMESTAMP`,
    ).bind(id, user.user_id, isRead, isPinned, isRead, isPinned).run();
    const state = await db.prepare(
      "SELECT post_id, is_read, is_pinned, updated_at FROM post_states WHERE post_id = ? AND user_id = ?",
    ).bind(id, user.user_id).first();
    return json({ state });
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest({ request }) {
  return methodNotAllowed(["PATCH"]);
}
