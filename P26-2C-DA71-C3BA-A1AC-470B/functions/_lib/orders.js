// Leitura de pedidos no formato do contrato (com itens).

// Carrega pedidos do usuário; se orderId vier, só aquele.
export async function loadOrders(env, userId, { orderId = null, limit = 50 } = {}) {
  const orders = orderId
    ? await env.DB.prepare(
        `SELECT id, total, item_count, balance_before, balance_after, created_at
           FROM orders WHERE id = ? AND user_id = ?`
      ).bind(orderId, userId).all()
    : await env.DB.prepare(
        `SELECT id, total, item_count, balance_before, balance_after, created_at
           FROM orders WHERE user_id = ?
          ORDER BY created_at DESC, rowid DESC LIMIT ?`
      ).bind(userId, limit).all();

  const list = orders.results || [];
  if (list.length === 0) return [];

  // Itens de todos os pedidos numa só consulta (placeholders gerados, valores via bind).
  const ids = list.map((o) => o.id);
  const placeholders = ids.map(() => "?").join(",");
  const items = await env.DB.prepare(
    `SELECT order_id, product_id, product_name, unit_price, quantity, subtotal
       FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id`
  ).bind(...ids).all();

  const byOrder = new Map(ids.map((id) => [id, []]));
  for (const it of items.results || []) {
    const { order_id, ...rest } = it;
    byOrder.get(order_id)?.push(rest);
  }
  return list.map((o) => ({ ...o, items: byOrder.get(o.id) || [] }));
}
