import { usuarioLogado } from '../_lib/sessao.js';

const ATRIBUTOS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];

function validar(b) {
  const nome = String(b.nome ?? '').trim();
  const classe = String(b.classe ?? '').trim();
  const nivel = Number(b.nivel);
  if (nome.length < 1 || nome.length > 60) return { erro: 'nome inválido (1 a 60 caracteres)' };
  if (classe.length > 40) return { erro: 'classe inválida (máximo 40 caracteres)' };
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 20) return { erro: 'nível inválido (1 a 20)' };
  const attrs = {};
  for (const a of ATRIBUTOS) {
    const v = Number(b[a]);
    if (!Number.isInteger(v) || v < 1 || v > 30) return { erro: `atributo ${a} inválido (1 a 30)` };
    attrs[a] = v;
  }
  return { ok: { nome, classe, nivel, ...attrs } };
}

const naoAutenticado = () => Response.json({ erro: 'não autenticado' }, { status: 401 });

export async function onRequestGet({ request, env }) {
  const u = await usuarioLogado(request, env);
  if (!u) return naoAutenticado();
  const { results } = await env.DB.prepare(
    'SELECT * FROM fichas WHERE discord_id = ? ORDER BY id DESC'
  ).bind(u.id).all();
  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const u = await usuarioLogado(request, env);
  if (!u) return naoAutenticado();
  const v = validar(await request.json().catch(() => ({})));
  if (v.erro) return Response.json(v, { status: 400 });
  const f = v.ok;
  const r = await env.DB.prepare(
    `INSERT INTO fichas (discord_id, nome, classe, nivel, forca, destreza, constituicao, inteligencia, sabedoria, carisma)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).bind(u.id, f.nome, f.classe, f.nivel, f.forca, f.destreza, f.constituicao,
         f.inteligencia, f.sabedoria, f.carisma).run();
  return Response.json({ id: r.meta.last_row_id }, { status: 201 });
}

export async function onRequestPut({ request, env }) {
  const u = await usuarioLogado(request, env);
  if (!u) return naoAutenticado();
  const b = await request.json().catch(() => ({}));
  const id = Number(b.id);
  if (!Number.isInteger(id)) return Response.json({ erro: 'id inválido' }, { status: 400 });
  const v = validar(b);
  if (v.erro) return Response.json(v, { status: 400 });
  const f = v.ok;
  const r = await env.DB.prepare(
    `UPDATE fichas SET nome=?, classe=?, nivel=?, forca=?, destreza=?, constituicao=?,
       inteligencia=?, sabedoria=?, carisma=? WHERE id=? AND discord_id=?`
  ).bind(f.nome, f.classe, f.nivel, f.forca, f.destreza, f.constituicao,
         f.inteligencia, f.sabedoria, f.carisma, id, u.id).run();
  return r.meta.changes
    ? Response.json({ ok: true })
    : Response.json({ erro: 'ficha não encontrada' }, { status: 404 });
}

export async function onRequestDelete({ request, env }) {
  const u = await usuarioLogado(request, env);
  if (!u) return naoAutenticado();
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id)) return Response.json({ erro: 'id inválido' }, { status: 400 });
  const r = await env.DB.prepare('DELETE FROM fichas WHERE id = ? AND discord_id = ?')
    .bind(id, u.id).run();
  return r.meta.changes
    ? new Response(null, { status: 204 })
    : Response.json({ erro: 'ficha não encontrada' }, { status: 404 });
}