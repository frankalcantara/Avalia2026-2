import { validarDisciplina } from "../../../public/js/calculo.js";
import { json, carregarDisciplinas, insertsAvaliacoes } from "../../_util.js";

const LIMITE = 20;

export async function onRequestGet({ env, data }) {
  return json({ disciplinas: await carregarDisciplinas(env.DB, data.user.userId) });
}

export async function onRequestPost({ request, env, data }) {
  const userId = data.user.userId;
  const v = validarDisciplina(await request.json().catch(() => null));
  if (!v.ok) return json({ erro: v.erro }, 400);
  const d = v.valor;

  // Limite checado no próprio INSERT (uma instrução SQLite é atômica): requisições simultâneas não passam de 20.
  const ins = await env.DB.prepare(
    `INSERT INTO disciplinas (user_id, nome, nota_max, media_aprovacao, media_exame, media_final)
     SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM disciplinas WHERE user_id = ?) < ?`
  ).bind(userId, d.nome, d.notaMax, d.mediaAprovacao, d.mediaExame, d.mediaFinal, userId, LIMITE).run();
  if (!ins.meta.changes) return json({ erro: `Limite de ${LIMITE} disciplinas atingido.` }, 409);

  const id = ins.meta.last_row_id;
  try {
    await env.DB.batch(insertsAvaliacoes(env.DB, "SELECT ?", [id], d.avaliacoes));
  } catch (e) {
    await env.DB.prepare("DELETE FROM disciplinas WHERE id = ?").bind(id).run(); // não deixa disciplina sem avaliações
    throw e;
  }
  const [disciplina] = await carregarDisciplinas(env.DB, userId, id);
  return json({ disciplina }, 201);
}
