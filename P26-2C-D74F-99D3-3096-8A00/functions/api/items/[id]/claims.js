import { readSession, json } from "../../../_lib/session.js";

export async function onRequestPost({ request, env, params }) {
  const user = await readSession(request, env);
  if (!user) return json({ ok: false, error: "Faça login com o Discord." }, 401);

  const itemId = Number(params.id);
  if (!Number.isInteger(itemId)) return json({ ok: false, error: "ID inválido." }, 400);

  const item = await env.DB.prepare("SELECT id, owner_id, status FROM items WHERE id = ?")
    .bind(itemId).first();
  if (!item) return json({ ok: false, error: "Item não encontrado." }, 404);
  if (item.owner_id === user.userId)
    return json({ ok: false, error: "Você não pode reivindicar o próprio item." }, 403);
  if (item.status === "encerrado")
    return json({ ok: false, error: "Este caso já foi encerrado." }, 409);

  const body = await request.json().catch(() => ({}));
  const message = String(body.message || "").trim().slice(0, 500);

  const dup = await env.DB.prepare(
    "SELECT id FROM claims WHERE item_id = ? AND claimant_id = ? AND status = 'pendente'"
  ).bind(itemId, user.userId).first();
  if (dup) return json({ ok: false, error: "Você já tem uma reivindicação pendente neste item." }, 409);

  const r = await env.DB.prepare(
    `INSERT INTO claims (item_id, claimant_id, claimant_contact, message)
     VALUES (?, ?, ?, ?)`
  ).bind(itemId, user.userId, user.username, message || null).run();

  return json({ ok: true, id: r.meta.last_row_id }, 201);
}