import { getSession, requireDB } from "../_lib/auth.js";
import {
  errorResponse,
  json,
  methodNotAllowed,
  readJson,
  requireKeys,
  requiredCourseCode,
} from "../_lib/http.js";

export async function onRequestGet({ request, env }) {
  try {
    const user = await getSession(request, env);
    const db = requireDB(env);
    const result = await db.prepare(
      "SELECT c.code, c.title, s.created_at FROM subscriptions s JOIN courses c ON c.code = s.course_code WHERE s.user_id = ? ORDER BY c.title, c.code",
    ).bind(user.user_id).all();
    return json({ subscriptions: result.results || [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getSession(request, env);
    const payload = await readJson(request);
    requireKeys(payload, ["course_code"]);
    const code = requiredCourseCode(payload.course_code);
    const db = requireDB(env);
    const course = await db.prepare("SELECT code FROM courses WHERE code = ?").bind(code).first();
    if (!course) return json({ error: "course_not_found", message: "Disciplina não encontrada." }, 404);
    await db.prepare(
      "INSERT OR IGNORE INTO subscriptions (user_id, course_code, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
    ).bind(user.user_id, code).run();
    return json({ ok: true, course_code: code }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const user = await getSession(request, env);
    const payload = await readJson(request);
    requireKeys(payload, ["course_code"]);
    const code = requiredCourseCode(payload.course_code);
    const db = requireDB(env);
    const result = await db.prepare(
      "DELETE FROM subscriptions WHERE user_id = ? AND course_code = ?",
    ).bind(user.user_id, code).run();
    return json({ ok: true, course_code: code, removed: Number(result.meta?.changes || 0) > 0 });
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest({ request }) {
  return methodNotAllowed(["GET", "POST", "DELETE"]);
}
