// POST /api/checkout — compra validada no servidor e gravada num único batch (transação).
import { json, error, checkOrigin } from "../_lib/http.js";
import { requireUser } from "../_lib/session.js";
import { loadOrders } from "../_lib/orders.js";

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

// Valida e agrega itens: Map(productId -> quantidade somada) ou null se inválido.
function parseItems(body) {
  const items = body?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) return null;
  const agg = new Map();
  for (const it of items) {
    if (!it || typeof it !== "object") return null;
    const { productId, quantity } = it;
    if (!isInt(productId, 1, Number.MAX_SAFE_INTEGER) || !isInt(quantity, 1, 99)) return null;
    agg.set(productId, (agg.get(productId) || 0) + quantity);
  }
  return agg;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const bad = checkOrigin(request);
  if (bad) return bad;

  const { user, response } = await requireUser(context);
  if (response) return response;

  // Corpo JSON
  let body;
  try {
    body = await request.json();
  } catch {
    return error(400, "invalid_json", "Corpo da requisição não é um JSON válido.");
  }
  const agg = parseItems(body);
  if (!agg) {
    return error(400, "invalid_items", "Envie 'items' com 1 a 50 entradas { productId inteiro > 0, quantity 1..99 }.");
  }

  // Preços e estoque vêm do D1, nunca do cliente.
  const ids = [...agg.keys()];
  const rows = await env.DB.prepare(
    `SELECT id, name, price, stock FROM products WHERE id IN (${ids.map(() => "?").join(",")})`
  ).bind(...ids).all();
  const byId = new Map((rows.results || []).map((p) => [p.id, p]));

  for (const id of ids) {
    if (!byId.has(id)) {
      return error(404, "product_not_found", `Produto ${id} não encontrado.`, { productId: id });
    }
  }

  const lines = ids.map((id) => {
    const p = byId.get(id);
    const quantity = agg.get(id);
    return { product: p, quantity, subtotal: p.price * quantity };
  });

  const short = lines
    .filter((l) => l.quantity > l.product.stock)
    .map((l) => ({ productId: l.product.id, name: l.product.name, requested: l.quantity, available: l.product.stock }));
  if (short.length) {
    return error(409, "insufficient_stock", "Estoque insuficiente para um ou mais produtos.", { details: short });
  }

  const total = lines.reduce((s, l) => s + l.subtotal, 0);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

  // Saldo atual relido do D1 (não o da sessão em cache).
  const fresh = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?").bind(user.user_id).first();
  const balance = fresh?.balance ?? 0;
  if (total > balance) {
    return error(409, "insufficient_balance", "Saldo insuficiente para concluir a compra.", { total, balance });
  }

  // Lote atômico: débito, baixa de estoque, pedido e itens. CHECKs (>= 0) desfazem tudo em corrida.
  const orderId = crypto.randomUUID();
  const stmts = [
    env.DB.prepare("UPDATE users SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .bind(total, user.user_id),
    ...lines.map((l) =>
      env.DB.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").bind(l.quantity, l.product.id)
    ),
    // balance_after vem do subselect já após o UPDATE; balance_before = after + total
    env.DB.prepare(
      `INSERT INTO orders (id, user_id, total, item_count, balance_before, balance_after)
       SELECT ?, ?, ?, ?, balance + ?, balance FROM users WHERE user_id = ?`
    ).bind(orderId, user.user_id, total, itemCount, total, user.user_id),
    ...lines.map((l) =>
      env.DB.prepare(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(orderId, l.product.id, l.product.name, l.product.price, l.quantity, l.subtotal)
    ),
  ];

  try {
    await env.DB.batch(stmts);
  } catch (err) {
    const msg = String(err?.message || err);
    if (/CHECK constraint/i.test(msg)) {
      return error(409, "conflict_retry", "Saldo ou estoque mudou durante a compra. Atualize e tente novamente.");
    }
    console.error("Falha no batch do checkout:", err);
    return error(500, "checkout_failed", "Não foi possível concluir a compra.");
  }

  // Relê pedido e saldo gravados.
  const [order] = await loadOrders(env, user.user_id, { orderId });
  return json({ ok: true, order, balance: order.balance_after }, 201);
}
