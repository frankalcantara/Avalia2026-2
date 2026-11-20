import { getSession, json, methodNotAllowed } from "../_shared/auth.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return methodNotAllowed("GET");

  try {
    const user = await getSession(request, env);
    if (!user) return json({ error: "Autenticação necessária." }, 401);
    if (!env.DB) return json({ error: "Banco de dados indisponível." }, 503);

    const [items, movements] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS total FROM items").first(),
      env.DB.prepare("SELECT COUNT(*) AS total FROM movements").first(),
    ]);
    return json({
      ok: true,
      d1Connected: true,
      totalItems: Number(items?.total || 0),
      totalMovements: Number(movements?.total || 0),
      serverTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Could not query inventory status.", error);
    return json({ error: "Não foi possível consultar o status." }, 500);
  }
}
