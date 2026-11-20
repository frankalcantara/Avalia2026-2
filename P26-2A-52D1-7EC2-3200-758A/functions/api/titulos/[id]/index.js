/**
 * GET /api/titulos/:id
 * Detalhes de um título: média, total, distribuição de notas e as resenhas da turma.
 */
import { erro, idValido, json, usuarioAtual } from "../../../../lib/servidor.js";

export async function onRequestGet({ request, env, params }) {
  const id = idValido(params.id);
  if (!id) return erro("Id inválido.");

  const titulo = await env.DB.prepare(
    `SELECT t.id, t.nome, t.tipo, t.ano_lancamento, t.genero,
            ROUND(COALESCE(AVG(a.nota), 0), 2) AS media, COUNT(a.nota) AS total
       FROM titulos t LEFT JOIN avaliacoes a ON a.filme_id = t.id
      WHERE t.id = ? GROUP BY t.id`
  ).bind(id).first();
  if (!titulo) return erro("Título não encontrado.", 404);

  const { results: avaliacoes } = await env.DB.prepare(
    `SELECT a.user_id, u.username, u.avatar, a.nota, a.resenha, a.atualizado_em
       FROM avaliacoes a JOIN discord_users u ON u.user_id = a.user_id
      WHERE a.filme_id = ? ORDER BY a.atualizado_em DESC`
  ).bind(id).all();

  const distribuicao = [0, 0, 0, 0, 0];
  for (const a of avaliacoes) distribuicao[a.nota - 1]++;

  const usuario = await usuarioAtual(env, request);
  const minha = usuario ? avaliacoes.find((a) => a.user_id === usuario.user_id) || null : null;

  return json({ ok: true, titulo, distribuicao, avaliacoes, minha });
}
