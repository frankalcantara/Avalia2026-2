import { json, error } from '../_lib/http.js';
import { getSessionUser } from '../_lib/session.js';

export async function onRequestGet({ request, env }) {
  const me = await getSessionUser(request, env);
  if (!me) return error('Não autenticado', 401);
  const { results } = await env.DB.prepare(
    'SELECT id, username, avatar FROM users WHERE id <> ? ORDER BY username COLLATE NOCASE ASC'
  )
    .bind(me.id)
    .all();
  return json({ users: results || [] });
}
