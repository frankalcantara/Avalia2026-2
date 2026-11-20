/**
 * POST /api/tickets/:code/status — muda o estado { status, note? }.
 * A máquina de estados e as permissões são validadas aqui, no servidor.
 */
import { requireUser } from "../../../_lib/session.js";
import { json, fail, readJson, sameOrigin, requireDb } from "../../../_lib/http.js";
import { validateStatusChange, canChangeStatus } from "../../../_lib/rules.js";
import { findTicket, ticketPayload } from "../../../_lib/tickets.js";

export async function onRequestPost({ request, env, params }) {
  const noDb = requireDb(env);
  if (noDb) return noDb;
  if (!sameOrigin(request)) return fail(403, "Origem não permitida.");
  const { user, response } = await requireUser(request, env);
  if (response) return response;

  const ticket = await findTicket(env, params.code);
  if (!ticket) return fail(404, "Chamado não encontrado.");

  const body = await readJson(request);
  if (!body) return fail(400, "Envie um JSON válido.");
  const v = validateStatusChange(body);
  if (!v.ok) return fail(422, "Dados inválidos.", { errors: v.errors });

  const { status: to, note } = v.data;
  const perm = canChangeStatus({ userId: user.user_id, admin: user.admin, ticket, to });
  if (!perm.ok) return fail(perm.status, perm.error);

  const now = new Date().toISOString();
  // O UPDATE só acontece se o estado ainda for o lido acima (evita corrida entre duas abas)
  const results = await env.DB.batch([
    env.DB.prepare(
      "UPDATE tickets SET status = ?, updated_at = ?, resolved_at = ? WHERE id = ? AND status = ?"
    ).bind(to, now, to === "resolvido" ? now : null, ticket.id, ticket.status),
    env.DB.prepare(
      `INSERT INTO ticket_events (ticket_id, author_id, kind, from_status, to_status, body)
       SELECT ?, ?, 'status', ?, ?, ? WHERE changes() > 0`
    ).bind(ticket.id, user.user_id, ticket.status, to, note || null),
  ]);
  if (!results[0].meta || results[0].meta.changes === 0) {
    return fail(409, "O chamado foi alterado por outra pessoa. Recarregue a página.");
  }

  const fresh = await findTicket(env, ticket.code);
  return json({ ok: true, ticket: await ticketPayload(env, fresh, user) });
}
