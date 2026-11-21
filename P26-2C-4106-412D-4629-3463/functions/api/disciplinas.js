import { protegido, json, falha, lerJson } from '../_lib/util.js';
import { validarDisciplina } from '../_lib/validacao.js';

export const onRequestGet = protegido(async ({ env, usuario }) => {
  const { results } = await env.DB.prepare(
    `SELECT d.codigo, d.nome, EXISTS(SELECT 1 FROM inscricoes i WHERE i.codigo = d.codigo AND i.user_id = ?1) AS inscrito
     FROM disciplinas d ORDER BY d.codigo`,
  ).bind(usuario.id).all();
  return json({ disciplinas: results.map((r) => ({ ...r, inscrito: !!r.inscrito })) });
});

export const onRequestPost = protegido(async ({ request, env, usuario }) => {
  const { corpo, erro } = await lerJson(request);
  if (erro) return erro;
  const v = validarDisciplina(corpo);
  if (!v.ok) return falha(400, v.erro);

  const { codigo, nome } = v.valor;
  const agora = Math.floor(Date.now() / 1000);
  const r = await env.DB.prepare('INSERT OR IGNORE INTO disciplinas (codigo, nome, criado_por, created_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(codigo, nome, usuario.id, agora).run();
  if (!r.meta.changes) return falha(409, 'Já existe uma disciplina com esse código.');
  // quem cria já passa a seguir
  await env.DB.prepare('INSERT OR IGNORE INTO inscricoes (user_id, codigo) VALUES (?1, ?2)').bind(usuario.id, codigo).run();
  return json({ disciplina: { codigo, nome, inscrito: true } }, 201);
});
