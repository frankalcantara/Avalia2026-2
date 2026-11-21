/**
 * /api/titulos/:id/avaliacao  (exige login)
 *   PUT    → cria OU edita a avaliação do usuário logado.
 *            A chave composta (user_id + filme_id) no D1 garante uma única nota por pessoa;
 *            o UPSERT (ON CONFLICT ... DO UPDATE) transforma uma segunda nota em edição.
 *   DELETE → remove a avaliação do usuário logado.
 * O user_id vem SEMPRE da sessão no servidor, nunca do corpo da requisição.
 */
import { erro, idValido, json, lerJson, limparTexto, usuarioAtual } from "../../../../lib/servidor.js";

export async function onRequestPut({ request, env, params }) {
  const usuario = await usuarioAtual(env, request);
  if (!usuario) return erro("Faça login com o Discord para avaliar.", 401);

  const filmeId = idValido(params.id);
  if (!filmeId) return erro("Id inválido.");

  const corpo = await lerJson(request);
  const nota = corpo.nota;
  const resenha = limparTexto(corpo.resenha);

  if (!Number.isInteger(nota) || nota < 1 || nota > 5) return erro("A nota deve ser um número inteiro de 1 a 5.");
  if (resenha.length > 500) return erro("A resenha pode ter no máximo 500 caracteres.");

  const existe = await env.DB.prepare("SELECT id FROM titulos WHERE id = ?").bind(filmeId).first();
  if (!existe) return erro("Título não encontrado.", 404);

  const anterior = await env.DB.prepare("SELECT 1 FROM avaliacoes WHERE user_id = ? AND filme_id = ?")
    .bind(usuario.user_id, filmeId).first();

  await env.DB.prepare(
    `INSERT INTO avaliacoes (user_id, filme_id, nota, resenha)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, filme_id) DO UPDATE SET
       nota = excluded.nota, resenha = excluded.resenha, atualizado_em = CURRENT_TIMESTAMP`
  ).bind(usuario.user_id, filmeId, nota, resenha).run();

  return json({ ok: true, editada: Boolean(anterior) }, anterior ? 200 : 201);
}

export async function onRequestDelete({ request, env, params }) {
  const usuario = await usuarioAtual(env, request);
  if (!usuario) return erro("Faça login com o Discord.", 401);

  const filmeId = idValido(params.id);
  if (!filmeId) return erro("Id inválido.");

  const res = await env.DB.prepare("DELETE FROM avaliacoes WHERE user_id = ? AND filme_id = ?")
    .bind(usuario.user_id, filmeId).run();
  if (!res.meta.changes) return erro("Você ainda não avaliou este título.", 404);
  return json({ ok: true });
}
