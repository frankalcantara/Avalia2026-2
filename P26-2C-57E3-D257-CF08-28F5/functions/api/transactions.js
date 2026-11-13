import { getSessionUser } from "../_shared/session.js";
import { json, readJson } from "../_shared/http.js";

export async function onRequestGet({ request, env }) {
  try {
    const user = await getSessionUser(request, env.SESSION_SECRET);
    if (!user) return json({ error: "Autenticação necessária." }, 401);
    if (!env.DB) return json({ error: "Banco D1 não configurado." }, 503);

    const { results } = await env.DB.prepare(
      `SELECT t.id, t.id_item, i.nome AS item_nome, t.quantidade_movimentada,
        t.tipo_movimento, t.user_id_discord, t.username_discord, t.timestamp
       FROM transacoes t
       JOIN itens i ON i.id = t.id_item
       ORDER BY t.timestamp DESC, t.id DESC
       LIMIT 12`,
    ).all();
    return json({ transactions: results });
  } catch {
    return json({ error: "Não foi possível consultar o histórico de movimentações." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  let user;
  try {
    user = await getSessionUser(request, env.SESSION_SECRET);
  } catch {
    return json({ error: "Não foi possível validar a sessão." }, 500);
  }
  if (!user) return json({ error: "Autenticação necessária." }, 401);
  if (!env.DB) return json({ error: "Banco D1 não configurado." }, 503);

  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  if (!parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    return json({ error: "O corpo deve ser um objeto JSON." }, 400);
  }

  const { item_id: itemId, quantity, type } = parsed.data;
  if (!Number.isSafeInteger(itemId) || itemId < 1) {
    return json({ error: "Selecione um item válido." }, 400);
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
    return json({ error: "A quantidade deve ser um inteiro entre 1 e 1.000.000." }, 400);
  }
  if (type !== "retirada" && type !== "devolucao") {
    return json({ error: "Tipo de movimentação inválido." }, 400);
  }

  const delta = type === "retirada" ? -quantity : quantity;
  const update = env.DB.prepare(
    "UPDATE itens SET quantidade_atual = quantidade_atual + ?, atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND quantidade_atual + ? >= 0",
  ).bind(delta, itemId, delta);
  const insert = env.DB.prepare(
    `INSERT INTO transacoes (id_item, quantidade_movimentada, tipo_movimento, user_id_discord, username_discord, timestamp)
     SELECT ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE changes() = 1`,
  ).bind(itemId, quantity, type, user.id, user.username);
  const rollbackIfUnaudited = env.DB.prepare(
    "UPDATE itens SET quantidade_atual = -1 WHERE id = ? AND changes() = 0",
  ).bind(itemId);

  const describeFailedMovement = async () => {
    try {
      const item = await env.DB.prepare(
        "SELECT id, quantidade_atual FROM itens WHERE id = ?",
      )
        .bind(itemId)
        .first();
      if (!item) return json({ error: "Item não encontrado." }, 404);
      if (type === "retirada" && item.quantidade_atual < quantity) {
        return json({ error: "Quantidade indisponível para retirada." }, 409);
      }
      return json({ error: "A movimentação não foi registrada na auditoria." }, 500);
    } catch {
      return json({ error: "Não foi possível confirmar o resultado da movimentação." }, 500);
    }
  };

  try {
    const [updateResult, insertResult] = await env.DB.batch([
      update,
      insert,
      rollbackIfUnaudited,
    ]);

    if (updateResult.meta?.changes !== 1 || insertResult.meta?.changes !== 1) {
      return describeFailedMovement();
    }
    return json({ ok: true }, 201);
  } catch {
    return describeFailedMovement();
  }
}
