import { getCookie, verifySession } from "../../lib/session.js";

const NIVEIS = ["nenhum", "baixo", "medio", "critico"];

// Só aceita quem tem cookie com assinatura válida.
// O dono da entrada vem DAQUI, nunca do corpo da requisição.
async function getUser(request, env) {
  const token = getCookie(request, "discord_session");
  if (!token || !env.SESSION_SECRET) return null;
  return verifySession(token, env.SESSION_SECRET);
}

// POST /api/entradas — cria uma entrada para o usuário logado
export async function onRequestPost({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return Response.json({ ok: false, error: "Faça login." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const texto = String(body.texto || "").trim().slice(0, 2000);
  const impedimento = String(body.impedimento || "nenhum");

  if (!texto) {
    return Response.json({ ok: false, error: "Texto obrigatório." }, { status: 400 });
  }
  if (!NIVEIS.includes(impedimento)) {
    return Response.json({ ok: false, error: "Nível inválido." }, { status: 400 });
  }

  // Sem created_at aqui: a data/hora UTC é carimbada pelo banco.
  const entrada = await env.DB.prepare(
    "INSERT INTO entradas (user_id, texto, impedimento) VALUES (?, ?, ?) RETURNING id, texto, impedimento, created_at"
  ).bind(user.userId, texto, impedimento).first();

  return Response.json({ ok: true, entrada }, { status: 201 });
}

// GET /api/entradas?q=palavra&de=AAAA-MM-DD&ate=AAAA-MM-DD
// Lista SÓ as entradas do usuário logado, com busca opcional.
export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return Response.json({ ok: false, error: "Faça login." }, { status: 401 });

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const de = url.searchParams.get("de") || "";
  const ate = url.searchParams.get("ate") || "";

  // O filtro por dono vem sempre primeiro: o diário é privado.
  let sql = "SELECT id, texto, impedimento, created_at FROM entradas WHERE user_id = ?";
  const params = [user.userId];

  if (q) {
    sql += " AND texto LIKE ?";
    params.push(`%${q}%`);
  }
  if (de) {
    sql += " AND date(created_at) >= ?";
    params.push(de);
  }
  if (ate) {
    sql += " AND date(created_at) <= ?";
    params.push(ate);
  }

  sql += " ORDER BY created_at DESC LIMIT 100";
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return Response.json({ ok: true, entradas: results });
}