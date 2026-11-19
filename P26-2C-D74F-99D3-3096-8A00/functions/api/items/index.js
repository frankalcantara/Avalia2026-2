import { readSession, json } from "../../_lib/session.js";
import { validateItem, TYPES, CATEGORIES } from "../../_lib/validate.js";

const STATUSES = ["aberto", "em_andamento", "encerrado"];

export async function onRequestGet({ request, env }) {
  const p = new URL(request.url).searchParams;
  const where = [];
  const args = [];

  const type = p.get("type");
  const category = p.get("category");
  const status = p.get("status");
  const q = (p.get("q") || "").trim().slice(0, 100);
  const local = (p.get("local") || "").trim().slice(0, 100);

  if (type) {
    if (!TYPES.includes(type)) return json({ ok: false, error: "Tipo inválido." }, 400);
    where.push("i.type = ?"); args.push(type);
  }
  if (category) {
    if (!CATEGORIES.includes(category)) return json({ ok: false, error: "Categoria inválida." }, 400);
    where.push("i.category = ?"); args.push(category);
  }
  if (status) {
    if (!STATUSES.includes(status)) return json({ ok: false, error: "Status inválido." }, 400);
    where.push("i.status = ?"); args.push(status);
  }
  if (q) {
    where.push("(i.title LIKE ? OR i.description LIKE ?)");
    args.push(`%${q}%`, `%${q}%`);
  }
  if (local) {
    where.push("i.location LIKE ?"); args.push(`%${local}%`);
  }

  const sql = `
    SELECT i.id, i.type, i.category, i.title, i.location, i.event_date,
           i.description, i.status, i.owner_id, i.created_at,
           u.username AS owner_name, u.avatar AS owner_avatar
    FROM items i JOIN discord_users u ON u.user_id = i.owner_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY i.id DESC LIMIT 100`;

  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return json({ ok: true, items: results });
}

export async function onRequestPost({ request, env }) {
  const user = await readSession(request, env);
  if (!user) return json({ ok: false, error: "Faça login com o Discord." }, 401);

  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: "JSON inválido." }, 400);

  const { errors, value } = validateItem(body);
  if (errors.length) return json({ ok: false, errors }, 400);

  const r = await env.DB.prepare(
    `INSERT INTO items (type, category, title, location, event_date, description, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(value.type, value.category, value.title, value.location,
         value.event_date, value.description, user.userId).run();

  return json({ ok: true, id: r.meta.last_row_id }, 201);
}