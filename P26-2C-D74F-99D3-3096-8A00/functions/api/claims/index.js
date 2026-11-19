import { readSession, json } from "../../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const user = await readSession(request, env);
  if (!user) return json({ ok: false, error: "Faça login com o Discord." }, 401);

  const base = `
    SELECT c.id, c.item_id, c.status, c.message, c.created_at, c.closed_at,
           c.claimant_id, c.claimant_contact, c.owner_contact,
           i.title AS item_title, i.type AS item_type, i.owner_id,
           o.username AS owner_name
    FROM claims c
    JOIN items i ON i.id = c.item_id
    JOIN discord_users o ON o.user_id = i.owner_id`;

  const mine = await env.DB.prepare(`${base} WHERE c.claimant_id = ? ORDER BY c.id DESC`)
    .bind(user.userId).all();
  const received = await env.DB.prepare(`${base} WHERE i.owner_id = ? ORDER BY c.id DESC`)
    .bind(user.userId).all();

  // owner_contact só é mostrado depois que o dono aceitou
  const clean = (rows) => rows.map((c) => ({
    ...c,
    owner_contact: c.status === "pendente" || c.status === "recusada" ? null : c.owner_contact,
  }));

  return json({ ok: true, mine: clean(mine.results), received: clean(received.results) });
}