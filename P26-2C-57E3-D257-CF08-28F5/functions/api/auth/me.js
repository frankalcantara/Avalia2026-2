import { getSessionUser } from "../../_shared/session.js";
import { json } from "../../_shared/http.js";

export async function onRequestGet({ request, env }) {
  try {
    const user = await getSessionUser(request, env.SESSION_SECRET);
    if (!user) return json({ error: "Autenticação necessária." }, 401);
    return json({ user });
  } catch {
    return json({ error: "Não foi possível validar a sessão." }, 500);
  }
}
