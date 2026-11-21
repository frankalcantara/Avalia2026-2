import { protegido, json, falha, lerJson } from '../../_lib/util.js';
import { validarAviso, validarId } from '../../_lib/validacao.js';

// Somente o autor (id da sessão OAuth2) pode editar ou remover.
async function buscarDoAutor(env, id, usuario) {
  const aviso = await env.DB.prepare('SELECT id, autor_id FROM avisos WHERE id = ?1').bind(id).first();
  if (!aviso) return { erro: falha(404, 'Aviso não encontrado.') };
  if (aviso.autor_id !== usuario.id) return { erro: falha(403, 'Só o autor pode alterar este aviso.') };
  return { aviso };
}

export const onRequestPatch = protegido(async ({ request, params, env, usuario }) => {
  const id = validarId(params.id);
  if (!id.ok) return falha(400, id.erro);
  const { erro: e1 } = await buscarDoAutor(env, id.valor, usuario);
  if (e1) return e1;

  const { corpo, erro } = await lerJson(request);
  if (erro) return erro;
  const v = validarAviso(corpo);
  if (!v.ok) return falha(400, v.erro);
  const a = v.valor;
  const disc = await env.DB.prepare('SELECT 1 FROM disciplinas WHERE codigo = ?1').bind(a.disciplina).first();
  if (!disc) return falha(404, 'Disciplina não encontrada.');

  const agora = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE avisos SET disciplina = ?1, tipo = ?2, titulo = ?3, corpo = ?4, url = ?5, prazo = ?6, updated_at = ?7
     WHERE id = ?8 AND autor_id = ?9`,
  ).bind(a.disciplina, a.tipo, a.titulo, a.corpo, a.url, a.prazo, agora, id.valor, usuario.id).run();
  return json({ id: id.valor });
});

export const onRequestDelete = protegido(async ({ params, env, usuario }) => {
  const id = validarId(params.id);
  if (!id.ok) return falha(400, id.erro);
  const { erro } = await buscarDoAutor(env, id.valor, usuario);
  if (erro) return erro;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM estado_aviso WHERE aviso_id = ?1').bind(id.valor),
    env.DB.prepare('DELETE FROM avisos WHERE id = ?1 AND autor_id = ?2').bind(id.valor, usuario.id),
  ]);
  return json({ ok: true });
});
