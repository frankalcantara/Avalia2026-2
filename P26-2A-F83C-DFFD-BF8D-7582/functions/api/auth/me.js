import { authenticateRequest, buildCookie } from '../../../lib/session.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const isHttps = url.protocol === 'https:';

  if (url.searchParams.get('logout') === '1') {
    const clearCookie = buildCookie('session', '', { maxAge: 0, isHttps });
    const accept = request.headers.get('Accept') || '';

    if (accept.includes('text/html') && !accept.includes('application/json')) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/',
          'Set-Cookie': clearCookie,
        },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': clearCookie,
      },
    });
  }

  const session = await authenticateRequest(request, env);

  if (!session || !session.user_id) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      user_id: session.user_id,
      username: session.username,
      avatar: session.avatar,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
