// GET /api/orders/:id — um pedido do usuário logado.
import { json, error } from "../../_lib/http.js";
import { requireUser } from "../../_lib/session.js";
import { loadOrders } from "../../_lib/orders.js";

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;

  const id = String(context.params.id || "");
  const notFound = () => error(404, "order_not_found", "Pedido não encontrado.");
  if (!id || id.length > 64) return notFound();

  // Filtra por user_id: pedido de outro usuário também vira 404.
  const [order] = await loadOrders(context.env, user.user_id, { orderId: id });
  if (!order) return notFound();
  return json({ ok: true, order });
}
