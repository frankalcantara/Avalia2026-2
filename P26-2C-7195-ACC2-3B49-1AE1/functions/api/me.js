import { publicUser, requireUser } from '../../lib/auth.js';
import { json } from '../../lib/http.js';

// GET /api/me — usuário logado (id, nome e avatar vindos do Discord).
export async function onRequestGet(context) {
  const auth = await requireUser(context);
  if (auth.response) return auth.response;
  return json({ user: publicUser(auth.user) });
}
