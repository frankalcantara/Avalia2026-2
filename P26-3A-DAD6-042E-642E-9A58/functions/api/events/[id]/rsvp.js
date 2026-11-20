import { requireMutation } from "../../../_shared/auth.js";
import { isPastDate, todayInSaoPaulo } from "../../../_shared/dates.js";
import { loadEventSummary } from "../../../_shared/events.js";
import { HttpError, handle, json, methodNotAllowed, parseId } from "../../../_shared/http.js";

const notFound = () => new HttpError(404, "not_found", "Evento não encontrado.");
const closed = () => new HttpError(409, "event_closed", "Este evento já aconteceu; inscrições encerradas.");
const duplicate = () => new HttpError(409, "already_registered", "Você já está inscrito neste evento.");

function isUniqueViolation(error) {
  const text = String((error && (error.message || error)) || "");
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(text);
}

// POST /api/events/:id/rsvp -> 201 { status, position, event }
// O corpo é ignorado: status e user_id nunca vêm do cliente.
export const onRequestPost = handle("rsvp create", async ({ request, env, params }) => {
  const user = await requireMutation(request, env);
  const id = parseId(params.id);
  const now = Date.now();
  const today = todayInSaoPaulo(now);

  const event = await env.DB.prepare("SELECT id, event_date FROM events WHERE id = ?1").bind(id).first();
  if (!event) throw notFound();
  if (isPastDate(event.event_date, now)) throw closed();

  const existing = await env.DB.prepare("SELECT id FROM registrations WHERE event_id = ?1 AND user_id = ?2")
    .bind(id, user.user_id)
    .first();
  if (existing) throw duplicate();

  // Decisão de vaga + inserção numa única instrução (atômica no D1):
  // conta os confirmados no momento da escrita e escolhe confirmed/waitlist.
  try {
    await env.DB.prepare(
      `INSERT INTO registrations (event_id, user_id, status, requested_at)
       SELECT e.id, ?2,
              CASE WHEN (SELECT COUNT(*) FROM registrations r
                          WHERE r.event_id = e.id AND r.status = 'confirmed') < e.capacity
                   THEN 'confirmed' ELSE 'waitlist' END,
              ?3
         FROM events e
        WHERE e.id = ?1 AND e.event_date >= ?4`,
    )
      .bind(id, user.user_id, now, today)
      .run();
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicate();
    throw error;
  }

  const registration = await env.DB.prepare(
    "SELECT id, status, requested_at FROM registrations WHERE event_id = ?1 AND user_id = ?2",
  )
    .bind(id, user.user_id)
    .first();
  if (!registration) {
    // Nada inserido: o evento sumiu ou fechou entre a checagem e a escrita.
    const still = await env.DB.prepare("SELECT id FROM events WHERE id = ?1").bind(id).first();
    throw still ? closed() : notFound();
  }

  const summary = await loadEventSummary(env, id, user.user_id);
  return json(201, {
    status: summary.my_status,
    position: summary.my_position,
    event: summary,
  });
});

// DELETE /api/events/:id/rsvp -> 200 { cancelled, promoted_user_id, event }
export const onRequestDelete = handle("rsvp cancel", async ({ request, env, params }) => {
  const user = await requireMutation(request, env);
  const id = parseId(params.id);

  const event = await env.DB.prepare("SELECT id FROM events WHERE id = ?1").bind(id).first();
  if (!event) throw notFound();

  const registration = await env.DB.prepare(
    "SELECT id, status FROM registrations WHERE event_id = ?1 AND user_id = ?2",
  )
    .bind(id, user.user_id)
    .first();
  if (!registration) {
    throw new HttpError(404, "not_registered", "Você não está inscrito neste evento.");
  }

  // Cancelamento + promoção do primeiro da fila na mesma transação (batch).
  // A condição de capacidade impede promoção quando quem saiu estava na fila.
  const now = Date.now();
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM registrations WHERE id = ?1 AND event_id = ?2 AND user_id = ?3").bind(
      registration.id,
      id,
      user.user_id,
    ),
    env.DB.prepare(
      `UPDATE registrations SET status = 'confirmed', promoted_at = ?1
        WHERE id = (SELECT id FROM registrations
                     WHERE event_id = ?2 AND status = 'waitlist'
                     ORDER BY requested_at, id LIMIT 1)
          AND (SELECT COUNT(*) FROM registrations WHERE event_id = ?2 AND status = 'confirmed')
              < (SELECT capacity FROM events WHERE id = ?2)
       RETURNING user_id`,
    ).bind(now, id),
  ]);

  const deleteMeta = results && results[0] && results[0].meta;
  if (deleteMeta && typeof deleteMeta.changes === "number" && deleteMeta.changes === 0) {
    // Outra requisição cancelou primeiro.
    throw new HttpError(404, "not_registered", "Você não está inscrito neste evento.");
  }

  let promotedUserId = null;
  const returned = results && results[1] && Array.isArray(results[1].results) ? results[1].results : null;
  if (returned && returned.length > 0 && returned[0].user_id) {
    promotedUserId = returned[0].user_id;
  } else {
    // Alternativa caso o driver não devolva as linhas do RETURNING no batch.
    const promoted = await env.DB.prepare(
      `SELECT user_id FROM registrations
        WHERE event_id = ?1 AND status = 'confirmed' AND promoted_at = ?2
        ORDER BY id LIMIT 1`,
    )
      .bind(id, now)
      .first();
    promotedUserId = promoted ? promoted.user_id : null;
  }

  const summary = await loadEventSummary(env, id, user.user_id);
  return json(200, { cancelled: true, promoted_user_id: promotedUserId, event: summary });
});

export function onRequest() {
  return methodNotAllowed("POST, DELETE");
}
