import {
  clearCookie,
  getSession,
  getSessionCookieName,
  hasDatabase,
  jsonResponse,
  methodNotAllowed
} from '../_utils.js';

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return methodNotAllowed('GET');
  }

  var session;
  try {
    session = await getSession(context.request, context.env);
  } catch (error) {
    console.error('Falha ao ler a sessão:', error);
    return jsonResponse({ error: 'Não foi possível validar a sessão.' }, 500);
  }
  if (!session) {
    return jsonResponse({ user: null }, 200);
  }
  if (!hasDatabase(context.env)) {
    return jsonResponse({ error: 'O banco D1 não está configurado.' }, 503);
  }

  try {
    var result = await context.env.DB.prepare(
      'SELECT id, username, avatar FROM users WHERE id = ?'
    ).bind(session.user_id).first();
    if (!result) {
      return new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': clearCookie(getSessionCookieName())
        }
      });
    }
    return jsonResponse({
      user: { id: result.id, username: result.username, avatar: result.avatar }
    }, 200);
  } catch (error) {
    console.error('Falha ao carregar o perfil do usuário:', error);
    return jsonResponse({ error: 'Não foi possível carregar o perfil.' }, 500);
  }
}
