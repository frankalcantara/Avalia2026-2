import { readSession } from "../_lib/session.js";
import { BADGES } from "../_lib/badges.js";

const ID_RE = /^\d{5,25}$/;
const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const received = url.searchParams.get("received");
  const sent = url.searchParams.get("sent");
  const where = [];
  const params = [];

  if (received) {
    if (!ID_RE.test(received)) return json({ error: "invalid_received", message: "Perfil inválido." }, 400);
    where.push("k.to_id = ?");
    params.push(received);
  }
  if (sent) {
    if (!ID_RE.test(sent)) return json({ error: "invalid_sent", message: "Perfil inválido." }, 400);
    where.push("k.from_id = ?");
    params.push(sent);
  }

  const sql = `SELECT k.id, k.badge, k.message, k.created_at,
      k.from_id, f.username AS from_username, f.avatar AS from_avatar,
      k.to_id, t.username AS to_username, t.avatar AS to_avatar
    FROM kudos k
    JOIN discord_users f ON f.user_id = k.from_id
    JOIN discord_users t ON t.user_id = k.to_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY k.id DESC LIMIT 100`;

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  const kudos = results.map((r) => ({ ...r, badge_label: BADGES[r.badge] || r.badge }));
  return json({ kudos });
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) {
    return json({ error: "forbidden_origin", message: "Origem não permitida." }, 403);
  }

  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) return json({ error: "not_authenticated", message: "Faça login com o Discord." }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Requisição inválida." }, 400);
  }

  const toId = String(body.to_id ?? "").trim();
  const badge = String(body.badge ?? "");
  const message = String(body.message ?? "").trim();

  if (!ID_RE.test(toId)) return json({ error: "invalid_recipient", message: "Escolha um colega." }, 400);
  if (toId === session.userId) {
    return json({ error: "self_kudos", message: "Você não pode elogiar a si mesmo." }, 400);
  }
  if (!Object.prototype.hasOwnProperty.call(BADGES, badge)) {
    return json({ error: "invalid_badge", message: "Escolha um selo válido." }, 400);
  }
  if (message.length < 3 || message.length > 280) {
    return json({ error: "invalid_message", message: "A mensagem deve ter entre 3 e 280 caracteres." }, 400);
  }

  try {
    const recipient = await env.DB.prepare("SELECT user_id FROM discord_users WHERE user_id = ?")
      .bind(toId).first();
    if (!recipient) return json({ error: "recipient_not_found", message: "Esse colega não existe." }, 404);

    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM kudos WHERE from_id = ? AND created_at > datetime('now', '-1 minute')"
    ).bind(session.userId).first();
    if (recent.n >= 5) {
      return json({ error: "rate_limited", message: "Calma! Aguarde um minuto para enviar mais." }, 429);
    }

    const r = await env.DB.prepare(
      "INSERT INTO kudos (from_id, to_id, badge, message) VALUES (?, ?, ?, ?)"
    ).bind(session.userId, toId, badge, message).run();
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  } catch {
    return json({ error: "server_error", message: "Erro ao salvar. Tente novamente." }, 500);
  }
}
