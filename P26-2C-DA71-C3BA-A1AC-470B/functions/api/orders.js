// GET /api/orders — últimos 50 pedidos do usuário, com itens.
import { json } from "../_lib/http.js";
import { requireUser } from "../_lib/session.js";
import { loadOrders } from "../_lib/orders.js";

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;
  const orders = await loadOrders(context.env, user.user_id, { limit: 50 });
  return json({ ok: true, orders });
}
