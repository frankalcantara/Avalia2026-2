import { avatarUrl } from './discord.js';
import { fail, isSameOrigin } from './http.js';
import { parseCookies, readSession, SESSION_COOKIE } from './session.js';

export async function getCurrentUser(request, env) {
  const token = parseCookies(request.headers.get('Cookie'))[SESSION_COOKIE];
  const session = await readSession(env.SESSION_SECRET, token);
  if (!session) return null;
  return env.DB.prepare('SELECT id, username, display_name, avatar FROM users WHERE id = ?')
    .bind(session.uid)
    .first();
}

export function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    avatarUrl: avatarUrl(row.id, row.avatar),
  };
}

/**
 * Guarda de rota: exige sessão válida e, em rotas que alteram estado, mesma origem.
 * Retorna { user } ou { response } (já pronta para devolver).
 */
export async function requireUser({ request, env }, { mutation = false } = {}) {
  if (mutation && !isSameOrigin(request)) {
    return { response: fail(403, 'Origem da requisição não permitida.', 'forbidden_origin') };
  }
  const user = await getCurrentUser(request, env);
  if (!user) return { response: fail(401, 'Faça login com o Discord.', 'unauthenticated') };
  return { user };
}
