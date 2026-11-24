import { getSessionUser } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const user = await getSessionUser(request, env);
  const nowIso = new Date().toISOString();

  // O texto só é lido do banco se a data de desbloqueio já passou.
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.title, c.target, c.unlock_date, c.created_at,
            u.username AS author, u.avatar,
            CASE WHEN c.unlock_date <= ?1 THEN c.body END AS body
       FROM capsules c JOIN discord_users u ON u.user_id = c.user_id
      WHERE c.target = 'turma' OR c.user_id = ?2
      ORDER BY c.unlock_date ASC`
  ).bind(nowIso, user ? user.user_id : "").all();

  const capsules = results.map((c) => {
    const unlocked = c.unlock_date <= nowIso;
    if (unlocked) return { ...c, locked: false };
    const { body, ...meta } = c; // garante que 'body' não vai no JSON
    return {
      ...meta,
      locked: true,
      seconds_left: Math.ceil((new Date(c.unlock_date) - new Date()) / 1000),
    };
  });

  return Response.json({ ok: true, serverTime: nowIso, capsules });
}

export async function onRequestPost({ request, env }) {
  const user = await getSessionUser(request, env);
  if (!user) return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const data = await request.json().catch(() => ({}));
  const title = String(data.title || "").trim();
  const body = String(data.body || "").trim();
  const target = data.target;
  const unlock = new Date(data.unlock_date);

  const erro = (msg) => Response.json({ ok: false, error: msg }, { status: 400 });
  if (title.length < 1 || title.length > 100) return erro("Título de 1 a 100 caracteres.");
  if (body.length < 1 || body.length > 2000) return erro("Mensagem de 1 a 2000 caracteres.");
  if (target !== "turma" && target !== "self") return erro("Destino inválido.");
  if (isNaN(unlock.getTime())) return erro("Data inválida.");
  if (unlock.getTime() <= Date.now()) return erro("A data de desbloqueio deve ser futura.");
  if (unlock.getTime() > Date.now() + 50 * 365 * 86400 * 1000) return erro("Data muito distante.");

  await env.DB.prepare(
    "INSERT INTO capsules (user_id, title, body, target, unlock_date) VALUES (?, ?, ?, ?, ?)"
  ).bind(user.user_id, title, body, target, unlock.toISOString()).run();

  return Response.json({ ok: true }, { status: 201 });
}