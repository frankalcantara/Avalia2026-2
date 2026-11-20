/** Acesso ao D1 para chamados e linha do tempo. */
import { normalizeTicketCode, allowedTransitionsFor, isClosed } from "./rules.js";

const TICKET_SELECT = `
  SELECT t.id, t.code, t.title, t.location, t.severity, t.description, t.status,
         t.author_id, t.created_at, t.updated_at, t.resolved_at,
         u.username AS author_name, u.avatar AS author_avatar
    FROM tickets t JOIN users u ON u.user_id = t.author_id`;

export async function findTicket(env, rawCode) {
  const code = normalizeTicketCode(rawCode);
  if (!code) return null;
  return env.DB.prepare(`${TICKET_SELECT} WHERE t.code = ?`).bind(code).first();
}

export async function listEvents(env, ticketId) {
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.kind, e.from_status, e.to_status, e.body, e.created_at,
            e.author_id, u.username AS author_name, u.avatar AS author_avatar
       FROM ticket_events e JOIN users u ON u.user_id = e.author_id
      WHERE e.ticket_id = ?
      ORDER BY e.id ASC`
  ).bind(ticketId).all();
  return results || [];
}

/** Monta a resposta completa de um chamado para o usuário atual. */
export async function ticketPayload(env, ticket, user) {
  const events = await listEvents(env, ticket.id);
  const { id, ...publicTicket } = ticket;
  return {
    ...publicTicket,
    events,
    permissions: {
      canComment: !isClosed(ticket.status),
      transitions: allowedTransitionsFor({ userId: user.user_id, admin: user.admin, ticket }),
    },
  };
}
