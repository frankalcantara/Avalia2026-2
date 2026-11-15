/**
 * Cloudflare Pages Function — GET /api/auth/eu
 *
 * Diz quem esta logado. A interface chama isso ao abrir a pagina para decidir
 * se mostra "Entrar com Discord" ou o avatar e o nome do jogador.
 *
 * Tambem e o teste que prova que a sessao funciona: entrar no site so mostra
 * que houve redirect; este endereco mostra que o cookie assinado foi gravado
 * e lido de volta.
 */

import { usuarioDaRequisicao } from "../../_lib/sessao.js";

/**
 * O Discord guarda o avatar como hash, nao como URL. Quando a pessoa nao tem
 * avatar, o campo vem nulo e o avatar padrao e calculado a partir do proprio
 * id — a formula abaixo e a do sistema novo de nomes de usuario.
 */
function urlDoAvatar(userId, hash) {
  if (hash) {
    const extensao = hash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${extensao}?size=128`;
  }
  const indice = Number((BigInt(userId) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${indice}.png`;
}

export async function onRequestGet({ request, env }) {
  const userId = await usuarioDaRequisicao(request, env);
  if (!userId) return Response.json({ autenticado: false });

  const usuario = await env.DB.prepare(
    "SELECT user_id, username, avatar FROM discord_users WHERE user_id = ?"
  )
    .bind(userId)
    .first();

  // Cookie assinado valido, mas o usuario sumiu do banco: trata como deslogado
  // em vez de confiar apenas na assinatura.
  if (!usuario) return Response.json({ autenticado: false });

  return Response.json({
    autenticado: true,
    userId: usuario.user_id,
    nome: usuario.username,
    avatarUrl: urlDoAvatar(usuario.user_id, usuario.avatar),
  });
}
