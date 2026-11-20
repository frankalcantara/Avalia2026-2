/** GET /api/me — usuário da sessão Discord (cookie assinado) ou 401. */
import { getSession, json } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const user = await getSession(request, env);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  return json({ ok: true, user });
}
