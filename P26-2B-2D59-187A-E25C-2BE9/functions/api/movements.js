import { getSession, json, methodNotAllowed } from "../_shared/auth.js";

const MAX_QUANTITY = 1_000_000;

export async function onRequest({ request, env }) {
  if (request.method === "GET") return listMovements(request, env);
  if (request.method === "POST") return createMovement(request, env);
  return methodNotAllowed("GET, POST");
}

async function listMovements(request, env) {
  try {
    const user = await getSession(request, env);
    if (!user) return json({ error: "Autenticação necessária." }, 401);
    if (!env.DB) return json({ error: "Banco de dados indisponível." }, 503);

    const result = await env.DB.prepare(
      `SELECT movements.id, movements.item_id, items.name AS item_name,
              movements.type, movements.quantity, movements.user_id,
              movements.username, movements.created_at
       FROM movements
       INNER JOIN items ON items.id = movements.item_id
       ORDER BY movements.created_at DESC, movements.id DESC
       LIMIT 100`,
    ).all();
    return json({ movements: result.results || [] });
  } catch (error) {
    console.error("Could not load movement history.", error);
    return json({ error: "Não foi possível carregar as movimentações." }, 500);
  }
}

async function createMovement(request, env) {
  let user;
  try {
    user = await getSession(request, env);
  } catch (error) {
    console.error("Discord session validation failed for movement.", error);
    return json({ error: "Autenticação não configurada." }, 500);
  }
  if (!user) return json({ error: "Autenticação necessária." }, 401);
  if (!env.DB) return json({ error: "Banco de dados indisponível." }, 503);

  const contentType = request.headers.get("Content-Type") || "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return json({ error: "O corpo deve ser enviado como application/json." }, 400);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 4096) return json({ error: "Corpo da requisição muito grande." }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "O corpo deve ser um objeto JSON." }, 400);
  }

  const keys = Object.keys(body).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== "item_id" ||
    keys[1] !== "quantity" ||
    keys[2] !== "type"
  ) {
    return json({ error: "Informe somente item_id, type e quantity." }, 400);
  }
  if (!Number.isSafeInteger(body.item_id) || body.item_id < 1 || body.item_id > 2_147_483_647) {
    return json({ error: "item_id inválido." }, 400);
  }
  if (!Number.isSafeInteger(body.quantity) || body.quantity < 1 || body.quantity > MAX_QUANTITY) {
    return json({ error: `quantity deve ser um inteiro entre 1 e ${MAX_QUANTITY}.` }, 400);
  }
  if (body.type !== "withdrawal" && body.type !== "return") {
    return json({ error: "type deve ser withdrawal ou return." }, 400);
  }

  try {
    const item = await env.DB.prepare("SELECT id FROM items WHERE id = ?")
      .bind(body.item_id)
      .first();
    if (!item) return json({ error: "Item não encontrado." }, 404);

    const updateSql = body.type === "withdrawal"
      ? "UPDATE items SET quantity = quantity - ? WHERE id = ? AND quantity >= ?"
      : "UPDATE items SET quantity = quantity + ? WHERE id = ? AND quantity <= 9007199254740991 - ?";
    const update = body.type === "withdrawal"
      ? env.DB.prepare(updateSql).bind(body.quantity, body.item_id, body.quantity)
      : env.DB.prepare(updateSql).bind(body.quantity, body.item_id, body.quantity);

    const insert = env.DB.prepare(
      `INSERT INTO movements (item_id, type, quantity, user_id, username)
       SELECT ?, ?, ?, ?, ? WHERE changes() = 1`,
    ).bind(body.item_id, body.type, body.quantity, user.user_id, user.username);
    const balance = env.DB.prepare("SELECT quantity FROM items WHERE id = ?")
      .bind(body.item_id);
    const results = await env.DB.batch([update, insert, balance]);

    if (Number(results?.[0]?.meta?.changes || 0) !== 1) {
      const currentItem = await env.DB.prepare("SELECT id FROM items WHERE id = ?")
        .bind(body.item_id)
        .first();
      if (!currentItem) return json({ error: "Item não encontrado." }, 404);
      if (body.type === "withdrawal") {
        return json({ error: "Saldo insuficiente para essa retirada." }, 409);
      }
      return json({ error: "O saldo ultrapassaria o limite suportado." }, 409);
    }

    const movementId = results?.[1]?.meta?.last_row_id;
    const newBalance = results?.[2]?.results?.[0]?.quantity;
    if (movementId === undefined || movementId === null) {
      return json({ error: "Não foi possível confirmar a movimentação." }, 500);
    }
    if (!Number.isSafeInteger(newBalance)) {
      return json({ error: "Não foi possível confirmar o saldo atualizado." }, 500);
    }
    const movement = await env.DB.prepare(
      `SELECT movements.id, movements.item_id, items.name AS item_name,
              movements.type, movements.quantity, movements.user_id,
              movements.username, movements.created_at
       FROM movements
       INNER JOIN items ON items.id = movements.item_id
       WHERE movements.id = ?`,
    ).bind(movementId).first();
    if (!movement) return json({ error: "Não foi possível confirmar a movimentação." }, 500);

    return json({
      movement,
      balance: newBalance,
    }, 201);
  } catch (error) {
    console.error("Could not persist inventory movement.", error);
    return json({ error: "Não foi possível registrar a movimentação." }, 500);
  }
}
