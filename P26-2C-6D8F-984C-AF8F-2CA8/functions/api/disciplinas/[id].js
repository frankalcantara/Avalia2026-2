import { validarDisciplina } from "../../../public/js/calculo.js";
import { json, carregarDisciplinas, insertsAvaliacoes } from "../../_util.js";

const naoEncontrada = () => json({ erro: "Disciplina não encontrada." }, 404);
const lerId = (params) => (/^[1-9]\d{0,15}$/.test(params.id) ? Number(params.id) : null);

export async function onRequestPut({ request, env, data, params }) {
  const id = lerId(params);
  if (!id) return json({ erro: "id inválido." }, 400);
  const userId = data.user.userId;
  const v = validarDisciplina(await request.json().catch(() => null));
  if (!v.ok) return json({ erro: v.erro }, 400);
  const dono = await env.DB.prepare("SELECT 1 FROM disciplinas WHERE id = ? AND user_id = ?").bind(id, userId).first();
  if (!dono) return naoEncontrada();
  const d = v.valor;

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE disciplinas SET nome = ?, nota_max = ?, media_aprovacao = ?, media_exame = ?, media_final = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`
    ).bind(d.nome, d.notaMax, d.mediaAprovacao, d.mediaExame, d.mediaFinal, id, userId),
    env.DB.prepare("DELETE FROM avaliacoes WHERE disciplina_id = ?").bind(id),
    ...insertsAvaliacoes(env.DB, "?", [id], d.avaliacoes),
  ]);
  const [disciplina] = await carregarDisciplinas(env.DB, userId, id);
  return json({ disciplina });
}

export async function onRequestDelete({ env, data, params }) {
  const id = lerId(params);
  if (!id) return json({ erro: "id inválido." }, 400);
  // Avaliações saem junto: explícito no batch, sem depender do PRAGMA foreign_keys.
  const [, del] = await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM avaliacoes WHERE disciplina_id IN (SELECT id FROM disciplinas WHERE id = ? AND user_id = ?)"
    ).bind(id, data.user.userId),
    env.DB.prepare("DELETE FROM disciplinas WHERE id = ? AND user_id = ?").bind(id, data.user.userId),
  ]);
  if (!del.meta.changes) return naoEncontrada();
  return json({ ok: true });
}
