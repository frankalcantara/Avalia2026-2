/** GET /api/tickets/:code — detalhes do chamado + linha do tempo + o que o usuário pode fazer. */
import { requireUser } from "../../_lib/session.js";
import { json, fail, requireDb } from "../../_lib/http.js";
import { findTicket, ticketPayload } from "../../_lib/tickets.js";

export async function onRequestGet({ request, env, params }) {
  const noDb = requireDb(env);
  if (noDb) return noDb;
  const { user, response } = await requireUser(request, env);
  if (response) return response;

  const ticket = await findTicket(env, params.code);
  if (!ticket) return fail(404, "Chamado não encontrado.");
  return json({ ok: true, ticket: await ticketPayload(env, ticket, user) });
}
