import { usuarioDaSessao, json, falha } from '../_lib/util.js';

export async function onRequestGet({ request, env }) {
  const usuario = await usuarioDaSessao(request, env);
  if (!usuario) return falha(401, 'Não autenticado.');
  return json({ usuario });
}
