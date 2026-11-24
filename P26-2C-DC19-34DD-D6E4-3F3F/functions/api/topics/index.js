import { json, erro, erroInterno, lerJson, mesmaOrigem, autorJson } from "../../_lib/http.js";
import { usuarioDaSessao } from "../../_lib/session.js";
import { validarTitulo, validarCorpo, parseId } from "../../_lib/validate.js";

const PAGE_SIZE = 20;

export async function onRequestGet({ request, env }) {
  try {
    const sp = new URL(request.url).searchParams;

    const status = sp.get("status");
    if (status && status !== "open" && status !== "resolved") {
      return erro(422, "Status deve ser open ou resolved.", "status");
    }
    let page = 1;
    if (sp.has("page") && sp.get("page") !== "") {
      page = parseId(sp.get("page"));
      if (!page) return erro(422, "Página inválida.", "page");
    }
    const q = (sp.get("q") || "").trim().slice(0, 120);

    const condicoes = [];
    const args = [];
    if (status) {
      condicoes.push("t.status = ?");
      args.push(status);
    }
    if (q) {
      condicoes.push("t.title LIKE ? ESCAPE '\\'");
      args.push(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

    const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM topics t ${where}`).bind(...args).first();
    const { results } = await env.DB.prepare(
      `SELECT t.id, t.title, t.status, t.created_at,
              (SELECT COUNT(*) FROM answers a WHERE a.topic_id = t.id) AS answer_count,
              u.id AS author_id, u.username, u.avatar_url
         FROM topics t JOIN users u ON u.id = t.author_id
         ${where}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ? OFFSET ?`
    )
      .bind(...args, PAGE_SIZE, (page - 1) * PAGE_SIZE)
      .all();

    return json({
      topics: results.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        created_at: r.created_at,
        answer_count: r.answer_count,
        author: autorJson(r.author_id, r.username, r.avatar_url),
      })),
      page,
      page_size: PAGE_SIZE,
      total: total ? total.n : 0,
    });
  } catch (e) {
    return erroInterno(e);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await usuarioDaSessao(env, request);
    if (!user) return erro(401, "Faça login para criar um tópico.");
    if (!mesmaOrigem(request)) return erro(403, "Origem não permitida.");
    const lido = await lerJson(request);
    if (lido.erro) return lido.erro;

    const titulo = validarTitulo(lido.data.title);
    if (!titulo.ok) return erro(422, titulo.error, titulo.field);
    const corpo = validarCorpo(lido.data.body);
    if (!corpo.ok) return erro(422, corpo.error, corpo.field);

    const r = await env.DB.prepare(
      "INSERT INTO topics (author_id, title, body, status, created_at) VALUES (?, ?, ?, 'open', ?)"
    )
      .bind(user.id, titulo.value, corpo.value, new Date().toISOString())
      .run();
    return json({ topic: { id: r.meta.last_row_id } }, 201);
  } catch (e) {
    return erroInterno(e);
  }
}
