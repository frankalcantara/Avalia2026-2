import { json, erro, erroInterno, autorJson } from "../../../_lib/http.js";
import { usuarioDaSessao } from "../../../_lib/session.js";
import { parseId } from "../../../_lib/validate.js";

export async function onRequestGet({ request, env, params }) {
  try {
    const id = parseId(params && params.id);
    if (!id) return erro(404, "Tópico não encontrado.");

    const t = await env.DB.prepare(
      `SELECT t.id, t.title, t.body, t.status, t.created_at, t.resolved_at, t.accepted_answer_id,
              t.author_id, u.username, u.avatar_url
         FROM topics t JOIN users u ON u.id = t.author_id WHERE t.id = ?`
    )
      .bind(id)
      .first();
    if (!t) return erro(404, "Tópico não encontrado.");

    const { results } = await env.DB.prepare(
      `SELECT a.id, a.body, a.created_at, u.id AS author_id, u.username, u.avatar_url
         FROM answers a JOIN users u ON u.id = a.author_id
        WHERE a.topic_id = ?
        ORDER BY (a.id = ?) DESC, a.created_at ASC, a.id ASC`
    )
      .bind(id, t.accepted_answer_id ?? 0)
      .all();

    const user = await usuarioDaSessao(env, request);
    const logado = !!user;
    const ehAutor = logado && String(user.id) === String(t.author_id);

    return json({
      topic: {
        id: t.id,
        title: t.title,
        body: t.body,
        status: t.status,
        created_at: t.created_at,
        resolved_at: t.resolved_at ?? null,
        accepted_answer_id: t.accepted_answer_id ?? null,
        author: autorJson(t.author_id, t.username, t.avatar_url),
      },
      answers: results.map((a) => ({
        id: a.id,
        body: a.body,
        created_at: a.created_at,
        is_accepted: t.accepted_answer_id != null && a.id === t.accepted_answer_id,
        author: autorJson(a.author_id, a.username, a.avatar_url),
      })),
      viewer: {
        logged_in: logado,
        is_author: ehAutor,
        can_answer: logado && !ehAutor && t.status === "open",
        can_accept: ehAutor && results.length > 0,
      },
    });
  } catch (e) {
    return erroInterno(e);
  }
}
