import { protegido, json, falha, lerJson } from '../../../_lib/util.js';
import { validarEstado, validarId } from '../../../_lib/validacao.js';

// "Lido" e "fixado" são individuais: cada usuário tem a sua visão.
export const onRequestPut = protegido(async ({ request, params, env, usuario }) => {
  const id = validarId(params.id);
  if (!id.ok) return falha(400, id.erro);
  const { corpo, erro } = await lerJson(request);
  if (erro) return erro;
  const v = validarEstado(corpo);
  if (!v.ok) return falha(400, v.erro);

  const existe = await env.DB.prepare('SELECT 1 FROM avisos WHERE id = ?1').bind(id.valor).first();
  if (!existe) return falha(404, 'Aviso não encontrado.');

  const atual = await env.DB.prepare('SELECT lido, fixado FROM estado_aviso WHERE user_id = ?1 AND aviso_id = ?2')
    .bind(usuario.id, id.valor).first();
  const lido = v.valor.lido ?? !!atual?.lido;
  const fixado = v.valor.fixado ?? !!atual?.fixado;
  await env.DB.prepare(
    `INSERT INTO estado_aviso (user_id, aviso_id, lido, fixado) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(user_id, aviso_id) DO UPDATE SET lido = ?3, fixado = ?4`,
  ).bind(usuario.id, id.valor, lido ? 1 : 0, fixado ? 1 : 0).run();
  return json({ id: id.valor, lido, fixado });
});
