import { lerSessao } from "../_lib/sessao.js";

export async function onRequestGet({ request, env }) {
  const u = await lerSessao(request, env);
  if (!u) return Response.json({ logado: false }, { status: 401 });
  return Response.json({ logado: true, id: u.userId, nome: u.username, avatar: u.avatar });
}
