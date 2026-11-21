/** /api/me — devolve o usuário da sessão assinada (user_id, nome e avatar do Discord). */
import { json, readSession } from "../_lib/util.js";

export async function onRequestGet({ request, env }) {
  const s = await readSession(request, env);
  if (!s) return json({ authenticated: false, user: null });
  return json({ authenticated: true, user: { userId: s.userId, username: s.username, avatar: s.avatar } });
}
