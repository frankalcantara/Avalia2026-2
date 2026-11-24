/**
 * GET /api/claims — reivindicações em que o usuário logado é uma das partes
 * (como quem publicou o item ou como quem reivindicou), com o contato do Discord das duas partes.
 */
import { json } from "../../_lib/http.js";
import { avatarUrl } from "../../_lib/auth.js";

export async function onRequestGet({ env, data }) {
  const me = data.user.user_id;
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.item_id, c.owner_id, c.claimant_id, c.owner_contact, c.claimant_contact,
            c.mensagem, c.status, c.created_at, c.updated_at,
            i.titulo, i.tipo, i.categoria, i.local, i.data_ocorrencia, i.status AS item_status,
            uo.global_name AS owner_nome, uo.avatar AS owner_avatar,
            uc.global_name AS claimant_nome, uc.avatar AS claimant_avatar
       FROM claims c
       JOIN items i ON i.id = c.item_id
       JOIN discord_users uo ON uo.user_id = c.owner_id
       JOIN discord_users uc ON uc.user_id = c.claimant_id
      WHERE c.owner_id = ? OR c.claimant_id = ?
      ORDER BY CASE c.status WHEN 'pendente' THEN 0 WHEN 'aceita' THEN 1 ELSE 2 END, c.id DESC
      LIMIT 200`
  ).bind(me, me).all();

  const reivindicacoes = (results || []).map((r) => ({
    id: r.id,
    status: r.status,
    mensagem: r.mensagem,
    created_at: r.created_at,
    updated_at: r.updated_at,
    meu_papel: r.owner_id === me ? "dono_do_anuncio" : "reivindicante",
    item: {
      id: r.item_id,
      titulo: r.titulo,
      tipo: r.tipo,
      categoria: r.categoria,
      local: r.local,
      data_ocorrencia: r.data_ocorrencia,
      status: r.item_status,
    },
    dono: {
      user_id: r.owner_id,
      nome: r.owner_nome || r.owner_contact,
      discord: r.owner_contact,
      avatar_url: avatarUrl(r.owner_id, r.owner_avatar),
      perfil_url: `https://discord.com/users/${r.owner_id}`,
    },
    reivindicante: {
      user_id: r.claimant_id,
      nome: r.claimant_nome || r.claimant_contact,
      discord: r.claimant_contact,
      avatar_url: avatarUrl(r.claimant_id, r.claimant_avatar),
      perfil_url: `https://discord.com/users/${r.claimant_id}`,
    },
  }));

  return json({ ok: true, total: reivindicacoes.length, reivindicacoes });
}
