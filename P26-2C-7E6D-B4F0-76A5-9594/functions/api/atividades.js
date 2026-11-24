import { readSession } from "../_lib/session.js";

const TETO_POR_CATEGORIA = 60;
const CATEGORIAS = ["ensino", "pesquisa", "extensao"];

function json(data, status = 200) {
  return Response.json(data, { status });
}

async function horasPorCategoria(env, userId) {
  const { results } = await env.DB.prepare(
    "SELECT categoria, COALESCE(SUM(horas), 0) AS total FROM atividades WHERE user_id = ? GROUP BY categoria"
  ).bind(userId).all();
  const horas = { ensino: 0, pesquisa: 0, extensao: 0 };
  for (const r of results) horas[r.categoria] = r.total;
  return horas;
}

export async function onRequestGet({ request, env }) {
  const sessao = await readSession(request, env.SESSION_SECRET);
  if (!sessao) return json({ error: "nao_autenticado" }, 401);

  const horas = await horasPorCategoria(env, sessao.userId);
  const { results } = await env.DB.prepare(
    "SELECT id, titulo, categoria, horas, link_certificado, created_at FROM atividades WHERE user_id = ? ORDER BY id DESC"
  ).bind(sessao.userId).all();

  return json({ teto: TETO_POR_CATEGORIA, horas, atividades: results });
}

export async function onRequestPost({ request, env }) {
  // 1. Quem é o usuário: SÓ pelo cookie assinado, nunca pelo corpo da requisição
  const sessao = await readSession(request, env.SESSION_SECRET);
  if (!sessao) return json({ error: "nao_autenticado" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "json_invalido" }, 400);
  }

  // 2. Validações
  const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
  if (titulo.length < 3 || titulo.length > 120) {
    return json({ error: "titulo_invalido", message: "O título deve ter entre 3 e 120 caracteres." }, 400);
  }

  if (!CATEGORIAS.includes(body.categoria)) {
    return json({ error: "categoria_invalida", message: "Use ensino, pesquisa ou extensao." }, 400);
  }

  const horas = body.horas;
  if (!Number.isInteger(horas) || horas < 1 || horas > TETO_POR_CATEGORIA) {
    return json({ error: "horas_invalidas", message: `Informe horas inteiras entre 1 e ${TETO_POR_CATEGORIA}.` }, 400);
  }

  let link;
  try {
    link = new URL(body.link_certificado);
  } catch {
    return json({ error: "link_invalido", message: "Informe uma URL válida para o certificado." }, 400);
  }
  if (link.protocol !== "https:") {
    return json({ error: "link_invalido", message: "O link do certificado deve começar com https://" }, 400);
  }

  // 3. Teto por categoria, checado e gravado numa única instrução (sem corrida entre requisições)
  const res = await env.DB.prepare(
    `INSERT INTO atividades (user_id, titulo, categoria, horas, link_certificado)
     SELECT ?, ?, ?, ?, ?
     WHERE (SELECT COALESCE(SUM(horas), 0) FROM atividades WHERE user_id = ? AND categoria = ?) + ? <= ?`
  ).bind(
    sessao.userId, titulo, body.categoria, horas, link.href,
    sessao.userId, body.categoria, horas, TETO_POR_CATEGORIA
  ).run();

  if (!res.meta || res.meta.changes === 0) {
    const atuais = await horasPorCategoria(env, sessao.userId);
    const restante = TETO_POR_CATEGORIA - atuais[body.categoria];
    return json({
      error: "teto_excedido",
      message: `O teto de ${TETO_POR_CATEGORIA}h para "${body.categoria}" seria ultrapassado. Ainda cabem ${restante}h.`,
      restante,
    }, 409);
  }

  return json({ ok: true }, 201);
}