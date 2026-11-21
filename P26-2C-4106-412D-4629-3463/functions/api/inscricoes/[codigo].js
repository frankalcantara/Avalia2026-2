import { protegido, json, falha } from '../../_lib/util.js';
import { validarCodigo } from '../../_lib/validacao.js';

// PUT = inscrever-se, DELETE = cancelar inscrição (sempre para o usuário da sessão).
export const onRequestPut = protegido(async ({ params, env, usuario }) => {
  const c = validarCodigo(decodeURIComponent(params.codigo));
  if (!c.ok) return falha(400, c.erro);
  const existe = await env.DB.prepare('SELECT 1 FROM disciplinas WHERE codigo = ?1').bind(c.valor).first();
  if (!existe) return falha(404, 'Disciplina não encontrada.');
  await env.DB.prepare('INSERT OR IGNORE INTO inscricoes (user_id, codigo) VALUES (?1, ?2)').bind(usuario.id, c.valor).run();
  return json({ codigo: c.valor, inscrito: true });
});

export const onRequestDelete = protegido(async ({ params, env, usuario }) => {
  const c = validarCodigo(decodeURIComponent(params.codigo));
  if (!c.ok) return falha(400, c.erro);
  await env.DB.prepare('DELETE FROM inscricoes WHERE user_id = ?1 AND codigo = ?2').bind(usuario.id, c.valor).run();
  return json({ codigo: c.valor, inscrito: false });
});
