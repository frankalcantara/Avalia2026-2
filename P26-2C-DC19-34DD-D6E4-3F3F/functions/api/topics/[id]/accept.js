import { json, erro, erroInterno, lerJson, mesmaOrigem } from "../../../_lib/http.js";
import { usuarioDaSessao } from "../../../_lib/session.js";
import { parseId } from "../../../_lib/validate.js";

const MSG_422 = "A resposta informada não pertence a este tópico.";

export async function onRequestPost({ request, env, params }) {
  try {
    const user = await usuarioDaSessao(env, request);
    if (!user) return erro(401, "Faça login para marcar a solução.");
    if (!mesmaOrigem(request)) return erro(403, "Origem não permitida.");

    const topicId = parseId(params && params.id);
    if (!topicId) return erro(404, "Tópico não encontrado.");
    const lido = await lerJson(request);
    if (lido.erro) return lido.erro;

    const topico = await env.DB.prepare("SELECT id, author_id FROM topics WHERE id = ?").bind(topicId).first();
    if (!topico) return erro(404, "Tópico não encontrado.");
    // Permissão: user_id da sessão contra topics.author_id (valor do D1). Nada é alterado se falhar.
    if (String(user.id) !== String(topico.author_id)) {
      return erro(403, "Apenas o autor do tópico pode marcar a solução.");
    }

    const raw = lido.data.answer_id;
    const answerId = typeof raw === "number" ? parseId(raw) : null;
    if (!answerId) return erro(422, "answer_id deve ser um inteiro positivo.", "answer_id");

    const resposta = await env.DB.prepare("SELECT id FROM answers WHERE id = ? AND topic_id = ?")
      .bind(answerId, topicId)
      .first();
    if (!resposta) return erro(422, MSG_422, "answer_id");

    const r = await env.DB.prepare(
      `UPDATE topics SET status = 'resolved', accepted_answer_id = ?, resolved_at = ?
        WHERE id = ? AND author_id = ?
          AND EXISTS (SELECT 1 FROM answers WHERE id = ? AND topic_id = ?)`
    )
      .bind(answerId, new Date().toISOString(), topicId, user.id, answerId, topicId)
      .run();

    if (r.meta.changes === 0) {
      // Mudou entre a leitura e a escrita: reavalia para responder o erro correspondente.
      const t2 = await env.DB.prepare("SELECT author_id FROM topics WHERE id = ?").bind(topicId).first();
      if (!t2) return erro(404, "Tópico não encontrado.");
      if (String(t2.author_id) !== String(user.id)) return erro(403, "Apenas o autor do tópico pode marcar a solução.");
      return erro(422, MSG_422, "answer_id");
    }

    return json({ ok: true, topic: { id: topicId, status: "resolved", accepted_answer_id: answerId } });
  } catch (e) {
    return erroInterno(e);
  }
}
