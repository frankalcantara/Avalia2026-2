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

const CYCLE_SELECT = "id, subject_id, duration_seconds, status, started_at, completed_at, cancelled_at";

function sameRequest(cycle, subjectId, durationSeconds) {
  return cycle.subject_id === subjectId && cycle.duration_seconds === durationSeconds;
}

export async function onRequestPost(context) {
  if (!requireSameOrigin(context.request)) return failure("csrf_rejected", 403, "Origem da requisição inválida.");
  const unavailable = requireDatabase(context.env);
  if (unavailable) return unavailable;
  const auth = await authenticate(context);
  if (auth.response) return auth.response;

  const idempotencyKey = context.request.headers.get("Idempotency-Key") || "";
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey)) {
    return failure("idempotency_key_required", 400, "Envie uma Idempotency-Key válida no cabeçalho.");
  }
  const body = await readJsonObject(context.request);
  const subjectId = validId(body?.subject_id);
  const durationSeconds = body?.duration_seconds;
  if (!subjectId || !Number.isInteger(durationSeconds) || durationSeconds < 60 || durationSeconds > 7200) {
    return failure("invalid_cycle", 400, "Informe subject_id e duração inteira entre 60 e 7200 segundos.");
  }

  let existing;
  try {
    existing = await context.env.DB.prepare(
      `SELECT ${CYCLE_SELECT} FROM pomodoro_cycles WHERE user_id = ? AND idempotency_key = ?`
    ).bind(auth.user.user_id, idempotencyKey).first();
  } catch {
    return databaseFailure();
  }
  if (existing) {
    if (!sameRequest(existing, subjectId, durationSeconds)) {
      return failure("idempotency_key_conflict", 409, "A chave já foi usada com parâmetros diferentes.");
    }
    return json({ ok: true, cycle: existing, replayed: true });
  }

  let subject;
  try {
    subject = await context.env.DB.prepare(
      "SELECT id FROM subjects WHERE id = ? AND user_id = ? AND archived_at IS NULL"
    ).bind(subjectId, auth.user.user_id).first();
  } catch {
    return databaseFailure();
  }
  if (!subject) return failure("subject_not_found", 404, "Disciplina não encontrada.");

  const startedAt = new Date().toISOString();
  try {
    const result = await context.env.DB.prepare(
      `INSERT INTO pomodoro_cycles (user_id, subject_id, idempotency_key, duration_seconds, status, started_at)
       VALUES (?, ?, ?, ?, 'running', ?)`
    ).bind(auth.user.user_id, subjectId, idempotencyKey, durationSeconds, startedAt).run();
    const cycle = await context.env.DB.prepare(
      `SELECT ${CYCLE_SELECT} FROM pomodoro_cycles WHERE id = ? AND user_id = ?`
    ).bind(result.meta.last_row_id, auth.user.user_id).first();
    return json({ ok: true, cycle, replayed: false }, 201);
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      return databaseFailure();
    }
    let replay;
    try {
      replay = await context.env.DB.prepare(
        `SELECT ${CYCLE_SELECT} FROM pomodoro_cycles WHERE user_id = ? AND idempotency_key = ?`
      ).bind(auth.user.user_id, idempotencyKey).first();
    } catch {
      return databaseFailure();
    }
    if (replay) {
      if (!sameRequest(replay, subjectId, durationSeconds)) {
        return failure("idempotency_key_conflict", 409, "A chave já foi usada com parâmetros diferentes.");
      }
      return json({ ok: true, cycle: replay, replayed: true });
    }
    if (isUniqueConstraintError(error)) {
      return failure("cycle_already_running", 409, "Já existe um ciclo em execução para este usuário.");
    }
    return databaseFailure();
  }
}