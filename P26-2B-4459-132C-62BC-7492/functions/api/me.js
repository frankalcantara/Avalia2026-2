// GET /api/me — usuário autenticado (id, nome e avatar vindos do Discord).
import { avatarUrl, requireUser } from '../_lib/auth.js';
import { handle, json } from '../_lib/http.js';

export const onRequestGet = handle(async ({ request, env }) => {
  const user = await requireUser(request, env);
  return json({ user: { id: user.id, name: user.name, avatarUrl: avatarUrl(user.id, user.avatar) } });
});
