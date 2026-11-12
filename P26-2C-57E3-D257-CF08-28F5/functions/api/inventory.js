import { getSessionUser } from "../_shared/session.js";
import { json } from "../_shared/http.js";

export async function onRequestGet({ request, env }) {
  try {
    const user = await getSessionUser(request, env.SESSION_SECRET);
    if (!user) return json({ error: "Autenticação necessária." }, 401);
    if (!env.DB) return json({ error: "Banco D1 não configurado." }, 503);

    const { results } = await env.DB.prepare(
      "SELECT id, nome, categoria, descricao, quantidade_atual, limite_minimo, unidade FROM itens ORDER BY categoria, nome",
    ).all();
    return json({ items: results });
  } catch {
    return json({ error: "Não foi possível consultar o inventário." }, 500);
  }
}
