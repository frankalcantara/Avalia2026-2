/**
 * Cloudflare Pages Function — GET /api/auth/me
 * Devolve { user_id, username, avatar } do usuário logado (avatar como URL completa) ou 401.
 */
import { getUser } from "../../_lib/auth.js";
import { json, methodNotAllowed } from "../../_lib/http.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") return methodNotAllowed("GET");

  try {
    const user = await getUser(request, env);
    if (!user) return json({ error: "Não autenticado" }, 401);
    return json({ user_id: user.user_id, username: user.username, avatar: user.avatar });
  } catch {
    return json({ error: "Erro interno" }, 500);
  }
}