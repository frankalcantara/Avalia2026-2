/** GET /api/auth/me — usuário da sessão atual (ou authenticated:false). */
import { getSessionUser, json } from "../../_lib/util.js";

export async function onRequestGet({ request, env }) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ authenticated: false });
  return json({ authenticated: true, user: { username: user.username, avatar: user.avatar } });
}
