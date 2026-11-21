import { protegido, json, falha, lerJson } from '../../_lib/util.js';
import { validarAviso, validarCodigo } from '../../_lib/validacao.js';

const COLUNAS = `a.id, a.disciplina, a.tipo, a.titulo, a.corpo, a.url, a.prazo,
  a.autor_id, a.autor_nome, a.autor_avatar, a.created_at, a.updated_at,
  COALESCE(e.lido, 0) AS lido, COALESCE(e.fixado, 0) AS fixado`;

const paraCliente = (r) => ({ ...r, lido: !!r.lido, fixado: !!r.fixado });

// Feed personalizado: avisos das disciplinas que o usuário segue (ou de uma disciplina específica via ?disciplina=).
export const onRequestGet = protegido(async ({ request, env, usuario }) => {
  const filtro = new URL(request.url).searchParams.get('disciplina');
  let stmt;
  if (filtro) {
    const c = validarCodigo(filtro);
    if (!c.ok) return falha(400, c.erro);
    stmt = env.DB.prepare(
      `SELECT ${COLUNAS} FROM avisos a
       LEFT JOIN estado_aviso e ON e.aviso_id = a.id AND e.user_id = ?1
       WHERE a.disciplina = ?2
       ORDER BY fixado DESC, a.created_at DESC, a.id DESC LIMIT 100`,
    ).bind(usuario.id, c.valor);
  } else {
    stmt = env.DB.prepare(
      `SELECT ${COLUNAS} FROM avisos a
       LEFT JOIN estado_aviso e ON e.aviso_id = a.id AND e.user_id = ?1
       WHERE a.disciplina IN (SELECT codigo FROM inscricoes WHERE user_id = ?1)
       ORDER BY fixado DESC, a.created_at DESC, a.id DESC LIMIT 100`,
    ).bind(usuario.id);
  }
  const { results } = await stmt.all();
  return json({ avisos: results.map(paraCliente) });
});

// Publicar: autor (id, nome, avatar) vem da sessão OAuth2 — nunca do corpo da requisição.
export const onRequestPost = protegido(async ({ request, env, usuario }) => {
  const { corpo, erro } = await lerJson(request);
  if (erro) return erro;
  const v = validarAviso(corpo);
  if (!v.ok) return falha(400, v.erro);
  const a = v.valor;

  const disc = await env.DB.prepare('SELECT 1 FROM disciplinas WHERE codigo = ?1').bind(a.disciplina).first();
  if (!disc) return falha(404, 'Disciplina não encontrada.');

  const agora = Math.floor(Date.now() / 1000);
  const r = await env.DB.prepare(
    `INSERT INTO avisos (disciplina, tipo, titulo, corpo, url, prazo, autor_id, autor_nome, autor_avatar, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`,
  ).bind(a.disciplina, a.tipo, a.titulo, a.corpo, a.url, a.prazo, usuario.id, usuario.nome, usuario.avatar, agora).run();
  return json({ id: r.meta.last_row_id }, 201);
});
