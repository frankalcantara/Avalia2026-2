import { requireUser } from "../_lib/auth.js";
import { database, HttpError, json } from "../_lib/http.js";

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const selectMovement = `
  SELECT m.id, m.item_id, i.name AS item_name, m.type, m.quantity,
         m.user_id, u.username, m.created_at
    FROM movements m
    JOIN items i ON i.id = m.item_id
    JOIN discord_users u ON u.user_id = m.user_id
`;

async function parseMovement(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Envie uma movimentação no formato JSON.");
  }

  const { item_id, type, quantity, request_id } = body ?? {};
  if (!Number.isSafeInteger(item_id) || item_id < 1) {
    throw new HttpError(400, "Selecione um item válido.");
  }
  if (type !== "withdrawal" && type !== "return") {
    throw new HttpError(400, "Selecione retirada ou devolução.");
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new HttpError(400, "Informe uma quantidade inteira maior que zero.");
  }
  if (typeof request_id !== "string" || !UUID_PATTERN.test(request_id)) {
    throw new HttpError(400, "O identificador da movimentação é inválido.");
  }

  return { itemId: item_id, type, quantity, requestId: request_id.toLowerCase() };
}

export async function onRequestGet({ request, env }) {
  await requireUser(request, env);
  const { results } = await database(env).prepare(
    selectMovement + " ORDER BY m.id DESC LIMIT 50",
  ).all();
  return json({ movements: results });
}

export async function onRequestPost({ request, env }) {
  const user = await requireUser(request, env);
  const { itemId, type, quantity, requestId } = await parseMovement(request);
  const db = database(env);
  const quantityDelta = type === "withdrawal" ? -quantity : quantity;
  // O INSERT testa o saldo atual e dispara o gatilho que atualiza o mesmo item.
  // A restrição de unicidade impede dupla movimentação em caso de reenvio.
  const [inserted, recorded, selected] = await db.batch([
    db.prepare(`
      INSERT INTO movements (item_id, type, quantity, user_id, request_id)
      SELECT id, ?, ?, ?, ?
        FROM items
       WHERE id = ? AND quantity + ? BETWEEN 0 AND 9007199254740991
      ON CONFLICT (user_id, request_id) DO NOTHING
      RETURNING id
    `).bind(type, quantity, user.user_id, requestId, itemId, quantityDelta),
    db.prepare(selectMovement + " WHERE m.user_id = ? AND m.request_id = ?").bind(user.user_id, requestId),
    db.prepare(
      "SELECT id, name, category, quantity, minimum_quantity, location FROM items WHERE id = ?",
    ).bind(itemId),
  ]);

  const movement = recorded.results[0];
  const item = selected.results[0];
  if (!movement) {
    if (!item) throw new HttpError(404, "Item não encontrado.");
    const message = type === "withdrawal"
      ? "Saldo insuficiente para essa retirada. Confira a quantidade disponível."
      : "O saldo ultrapassaria o limite aceito para esse item.";
    throw new HttpError(409, message);
  }

  if (movement.item_id !== itemId || movement.type !== type || movement.quantity !== quantity) {
    throw new HttpError(409, "Esse identificador já foi usado para outra movimentação.");
  }
  return json({ movement, item }, inserted.results.length ? 201 : 200);
}
