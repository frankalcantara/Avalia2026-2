import { json, error } from '../_lib/http.js';
import { getSessionUser } from '../_lib/session.js';

export async function onRequestGet({ request, env }) {
  const user = await getSessionUser(request, env);
  if (!user) return error('Não autenticado', 401);
  return json({ user: { id: user.id, username: user.username, avatar: user.avatar } });
}
