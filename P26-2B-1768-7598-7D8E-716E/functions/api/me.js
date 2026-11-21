import { json, getUser } from "../_lib/util.js";
export async function onRequestGet({ request, env }) {
  const u = await getUser(request, env);
  return u ? json(u) : json({ erro: "Não autenticado" }, 401);
}
