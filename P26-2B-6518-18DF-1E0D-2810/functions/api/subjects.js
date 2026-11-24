import {
  authenticate,
  databaseFailure,
  failure,
  isUniqueConstraintError,
  json,
  readJsonObject,
  requireDatabase,
  requireSameOrigin,
} from "../_shared.js";

const SUBJECT_SELECT = "id, name, created_at, updated_at, archived_at";

export async function onRequestGet(context) {
  const unavailable = requireDatabase(context.env);
  if (unavailable) return unavailable;
  const auth = await authenticate(context);
  if (auth.response) return auth.response;

  try {
    const result = await context.env.DB.prepare(
      `SELECT ${SUBJECT_SELECT} FROM subjects WHERE user_id = ? AND archived_at IS NULL ORDER BY name COLLATE NOCASE`
    ).bind(auth.user.user_id).all();
    return json({ ok: true, subjects: result.results || [] });
  } catch {
    return databaseFailure();
  }
}

export async function onRequestPost(context) {
  if (!requireSameOrigin(context.request)) return failure("csrf_rejected", 403, "Origem da requisição inválida.");
  const unavailable = requireDatabase(context.env);
  if (unavailable) return unavailable;
  const auth = await authenticate(context);
  if (auth.response) return auth.response;

  const body = await readJsonObject(context.request);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 80) {
    return failure("invalid_subject_name", 400, "Informe um nome de disciplina entre 1 e 80 caracteres.");
  }

  const now = new Date().toISOString();
  try {
    const result = await context.env.DB.prepare(
      "INSERT INTO subjects (user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ).bind(auth.user.user_id, name, now, now).run();
    const subject = await context.env.DB.prepare(
      `SELECT ${SUBJECT_SELECT} FROM subjects WHERE id = ? AND user_id = ?`
    ).bind(result.meta.last_row_id, auth.user.user_id).first();
    return json({ ok: true, subject }, 201);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return failure("subject_name_conflict", 409, "Já existe uma disciplina ativa com esse nome.");
    }
    return databaseFailure();
  }
}