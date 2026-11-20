import {
  authenticate,
  databaseFailure,
  failure,
  isUniqueConstraintError,
  json,
  readJsonObject,
  requireDatabase,
  requireSameOrigin,
  validId,
} from "../../_shared.js";

const SUBJECT_SELECT = "id, name, created_at, updated_at, archived_at";

export async function onRequestPatch(context) {
  if (!requireSameOrigin(context.request)) return failure("csrf_rejected", 403, "Origem da requisição inválida.");
  const unavailable = requireDatabase(context.env);
  if (unavailable) return unavailable;
  const auth = await authenticate(context);
  if (auth.response) return auth.response;

  const id = validId(context.params.id);
  if (!id) return failure("invalid_subject_id", 400, "ID de disciplina inválido.");
  const body = await readJsonObject(context.request);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 80) {
    return failure("invalid_subject_name", 400, "Informe um nome de disciplina entre 1 e 80 caracteres.");
  }

  try {
    const result = await context.env.DB.prepare(
      `UPDATE subjects SET name = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND archived_at IS NULL`
    ).bind(name, new Date().toISOString(), id, auth.user.user_id).run();
    if (!result.meta.changes) return failure("subject_not_found", 404, "Disciplina não encontrada.");
    const subject = await context.env.DB.prepare(
      `SELECT ${SUBJECT_SELECT} FROM subjects WHERE id = ? AND user_id = ?`
    ).bind(id, auth.user.user_id).first();
    return json({ ok: true, subject });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return failure("subject_name_conflict", 409, "Já existe uma disciplina ativa com esse nome.");
    }
    return databaseFailure();
  }
}

export async function onRequestDelete(context) {
  if (!requireSameOrigin(context.request)) return failure("csrf_rejected", 403, "Origem da requisição inválida.");
  const unavailable = requireDatabase(context.env);
  if (unavailable) return unavailable;
  const auth = await authenticate(context);
  if (auth.response) return auth.response;

  const id = validId(context.params.id);
  if (!id) return failure("invalid_subject_id", 400, "ID de disciplina inválido.");
  try {
    const now = new Date().toISOString();
    const result = await context.env.DB.prepare(
      `UPDATE subjects SET archived_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND archived_at IS NULL`
    ).bind(now, now, id, auth.user.user_id).run();
    if (!result.meta.changes) return failure("subject_not_found", 404, "Disciplina não encontrada.");

    const subject = await context.env.DB.prepare(
      `SELECT ${SUBJECT_SELECT} FROM subjects WHERE id = ? AND user_id = ?`
    ).bind(id, auth.user.user_id).first();
    return json({ ok: true, subject });
  } catch {
    return databaseFailure();
  }
}