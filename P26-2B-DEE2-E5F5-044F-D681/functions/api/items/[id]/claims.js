/**
 * POST /api/items/:id/claims   { "mensagem": "..." }
 * Abre uma reivindicação sobre um item. Regras (validadas no servidor):
 *  - precisa estar logado (middleware);
 *  - o item precisa existir e estar "aberto";
 *  - não pode reivindicar o próprio item;
 *  - só uma reivindicação ativa (pendente/aceita) por pessoa por item;
 *  - grava no D1 o contato do Discord das DUAS partes.
 */
import { json, erro, lerJson, texto, idValido } from "../../../_lib/http.js";

export async function onRequestPost({ request, env, params, data }) {
  const itemId = idValido(params.id);
  if (!itemId) return erro(400, "id_invalido", "Item inválido.");
  const { body, erro: e } = await lerJson(request);
  if (e) return e;

  const mensagem = texto(body.mensagem);
  if (mensagem.length < 10 || mensagem.length > 500) {
    return erro(400, "validacao", "Explique em 10 a 500 caracteres por que o item é seu (ou onde o encontrou).", {
      mensagem: "Entre 10 e 500 caracteres.",
    });
  }

  const item = await env.DB.prepare(
    `SELECT i.id, i.status, i.owner_id, u.username AS owner_username
       FROM items i JOIN discord_users u ON u.user_id = i.owner_id
      WHERE i.id = ?`
  ).bind(itemId).first();

  if (!item) return erro(404, "nao_encontrado", "Item não encontrado.");
  if (item.owner_id === data.user.user_id) return erro(403, "item_proprio", "Você não pode reivindicar um item que você mesmo publicou.");
  if (item.status !== "aberto") return erro(409, "item_indisponivel", "Este item não está mais aberto para reivindicações.");

  const ativa = await env.DB.prepare(
    "SELECT id FROM claims WHERE item_id = ? AND claimant_id = ? AND status IN ('pendente','aceita')"
  ).bind(itemId, data.user.user_id).first();
  if (ativa) return erro(409, "reivindicacao_duplicada", "Você já tem uma reivindicação ativa para este item.");

  try {
    const r = await env.DB.prepare(
      `INSERT INTO claims (item_id, owner_id, claimant_id, owner_contact, claimant_contact, mensagem)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
    )
      .bind(itemId, item.owner_id, data.user.user_id, item.owner_username, data.user.username, mensagem)
      .first();
    return json({ ok: true, id: r.id, status: "pendente" }, 201);
  } catch (err) {
    if (String(err?.message || err).includes("UNIQUE")) {
      return erro(409, "reivindicacao_duplicada", "Você já tem uma reivindicação ativa para este item.");
    }
    throw err;
  }
}
