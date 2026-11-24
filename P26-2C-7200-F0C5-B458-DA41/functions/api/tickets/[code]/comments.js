/** POST /api/tickets/:code/comments — adiciona comentário técnico (bloqueado após "Resolvido"). */
import { requireUser } from "../../../_lib/session.js";
import { json, fail, readJson, sameOrigin, requireDb } from "../../../_lib/http.js";
import { validateComment, isClosed } from "../../../_lib/rules.js";
import { findTicket, ticketPayload } from "../../../_lib/tickets.js";

export async function onRequestPost({ request, env, params }) {
  const noDb = requireDb(env);
  if (noDb) return noDb;
  if (!sameOrigin(request)) return fail(403, "Origem não permitida.");
  const { user, response } = await requireUser(request, env);
  if (response) return response;

  const ticket = await findTicket(env, params.code);
  if (!ticket) return fail(404, "Chamado não encontrado.");
  if (isClosed(ticket.status)) return fail(409, "Chamado resolvido (fechado): não aceita novos comentários.");

  const body = await readJson(request);
  if (!body) return fail(400, "Envie um JSON válido.");
  const v = validateComment(body);
  if (!v.ok) return fail(422, "Comentário inválido.", { errors: v.errors });

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO ticket_events (ticket_id, author_id, kind, body) VALUES (?, ?, 'comentario', ?)"
    ).bind(ticket.id, user.user_id, v.data.body),
    env.DB.prepare("UPDATE tickets SET updated_at = ? WHERE id = ?").bind(now, ticket.id),
  ]);

  const fresh = await findTicket(env, ticket.code);
  return json({ ok: true, ticket: await ticketPayload(env, fresh, user) }, 201);
}
