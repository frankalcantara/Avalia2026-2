import { usuarioLogado } from '../_lib/sessao.js';

export async function onRequestGet({ request, env }) {
  const u = await usuarioLogado(request, env);
  if (!u) return Response.json({ erro: 'não autenticado' }, { status: 401 });
  const { results } = await env.DB.prepare(
    `SELECT id, username, personagem, atributo, dado, resultado, modificador, total, criado_em
     FROM rolagens ORDER BY id DESC LIMIT 50`
  ).all();
  return Response.json(results);
}