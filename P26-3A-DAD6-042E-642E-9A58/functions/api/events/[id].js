import { requireMutation } from "../../_shared/auth.js";
import { loadAttendees, loadEventSummary } from "../../_shared/events.js";
import { HttpError, handle, json, methodNotAllowed, noContent, parseId } from "../../_shared/http.js";
import { getSessionUser } from "../../_shared/session.js";

// GET /api/events/:id -> { event, confirmed, waitlist }
export const onRequestGet = handle("event detail", async ({ request, env, params }) => {
  const id = parseId(params.id);
  const user = await getSessionUser(request, env);
  const event = await loadEventSummary(env, id, user ? user.user_id : null);
  if (!event) throw new HttpError(404, "not_found", "Evento não encontrado.");
  const { confirmed, waitlist } = await loadAttendees(env, id);
  return json(200, { event, confirmed, waitlist });
});

// DELETE /api/events/:id -> 204 (somente o criador)
export const onRequestDelete = handle("event delete", async ({ request, env, params }) => {
  const user = await requireMutation(request, env);
  const id = parseId(params.id);
  const event = await env.DB.prepare("SELECT creator_id FROM events WHERE id = ?1").bind(id).first();
  if (!event) throw new HttpError(404, "not_found", "Evento não encontrado.");
  if (event.creator_id !== user.user_id) {
    throw new HttpError(403, "forbidden", "Só quem criou o evento pode excluí-lo.");
  }
  // Inscrições apagadas explicitamente (não depende de PRAGMA foreign_keys).
  await env.DB.batch([
    env.DB.prepare("DELETE FROM registrations WHERE event_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM events WHERE id = ?1 AND creator_id = ?2").bind(id, user.user_id),
  ]);
  return noContent();
});

export function onRequest() {
  return methodNotAllowed("GET, DELETE");
}
