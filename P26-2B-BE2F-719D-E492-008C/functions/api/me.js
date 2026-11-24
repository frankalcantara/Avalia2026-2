import { usuarioLogado } from '../_lib/sessao.js';

export async function onRequestGet({ request, env }) {
  const u = await usuarioLogado(request, env);
  if (!u) return Response.json({ erro: 'não autenticado' }, { status: 401 });
  return Response.json({ id: u.id, nome: u.nome, avatar: u.avatar });
}