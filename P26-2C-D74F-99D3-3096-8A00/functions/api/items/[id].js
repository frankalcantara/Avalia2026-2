import { json } from "../../_lib/session.js";

export async function onRequestGet({ params, env }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "ID inválido." }, 400);

  const item = await env.DB.prepare(
    `SELECT i.*, u.username AS owner_name, u.avatar AS owner_avatar
     FROM items i JOIN discord_users u ON u.user_id = i.owner_id WHERE i.id = ?`
  ).bind(id).first();

  if (!item) return json({ ok: false, error: "Item não encontrado." }, 404);
  return json({ ok: true, item });
}