import { json, erro, erroInterno, lerJson, mesmaOrigem } from "../../../_lib/http.js";
import { usuarioDaSessao } from "../../../_lib/session.js";
import { parseId, validarResposta } from "../../../_lib/validate.js";

export async function onRequestPost({ request, env, params }) {
  try {
    const user = await usuarioDaSessao(env, request);
    if (!user) return erro(401, "Faça login para responder.");
    if (!mesmaOrigem(request)) return erro(403, "Origem não permitida.");

    const id = parseId(params && params.id);
    if (!id) return erro(404, "Tópico não encontrado.");
    const lido = await lerJson(request);
    if (lido.erro) return lido.erro;

    const topico = await env.DB.prepare("SELECT id, author_id, status FROM topics WHERE id = ?").bind(id).first();
    if (!topico) return erro(404, "Tópico não encontrado.");
    if (String(topico.author_id) === String(user.id)) {
      return erro(403, "Você não pode responder ao seu próprio tópico.");
    }
    if (topico.status === "resolved") return erro(409, "Este tópico já está resolvido.");

    const resp = validarResposta(lido.data.body);
    if (!resp.ok) return erro(422, resp.error, resp.field);

    // Inserção condicionada ao tópico ainda estar aberto (evita corrida com o accept).
    const r = await env.DB.prepare(
      `INSERT INTO answers (topic_id, author_id, body, created_at)
       SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM topics WHERE id = ? AND status = 'open')`
    )
      .bind(id, user.id, resp.value, new Date().toISOString(), id)
      .run();
    if (!r.meta.changes) return erro(409, "Este tópico já está resolvido.");
    return json({ answer: { id: r.meta.last_row_id } }, 201);
  } catch (e) {
    return erroInterno(e);
  }
}
