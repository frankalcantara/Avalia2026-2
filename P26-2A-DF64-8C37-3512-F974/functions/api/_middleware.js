// Middleware de todas as rotas /api/*:
// - exige o binding D1;
// - bloqueia requisições de escrita de outras origens (CSRF);
// - carrega o estudante da sessão e responde 401 nas rotas protegidas;
// - converte erros em respostas JSON.
import { HttpError, errorResponse } from '../_lib/http.js';
import { getSessionUser } from '../_lib/session.js';
import { DEFAULT_TZ, resolveTimeZone } from '../_lib/dates.js';

const TZ_CHANGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * O fuso que define o "hoje" da fila fica gravado no servidor. O cliente pode
 * propor um fuso (X-Timezone), mas a troca só é aceita uma vez a cada 24h,
 * o que impede burlar o limite diário de cartões novos trocando de fuso.
 */
async function resolveUserTimeZone(db, user, request) {
  const raw = request.headers.get('x-timezone');
  const proposed = raw ? resolveTimeZone(raw) : null;
  const stored = user.timezone ? resolveTimeZone(user.timezone) : null;
  const now = Date.now();
  const canChange = !stored || now - (Number(user.tz_updated_at) || 0) > TZ_CHANGE_INTERVAL_MS;
  if (proposed && proposed !== stored && canChange) {
    await db.prepare('UPDATE users SET timezone = ?, tz_updated_at = ? WHERE id = ?').bind(proposed, now, user.id).run();
    return proposed;
  }
  return stored || proposed || DEFAULT_TZ;
}

const PUBLIC_ROUTES = new Set([
  '/api/status',
  '/api/auth/discord',
  '/api/auth/discord/callback',
  '/api/auth/logout',
]);

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (!env.DB) {
      return errorResponse(500, 'Banco D1 não configurado (binding "DB").', 'db_missing');
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('origin');
      const site = request.headers.get('sec-fetch-site');
      if ((origin && origin !== url.origin) || (site && site !== 'same-origin' && site !== 'none')) {
        return errorResponse(403, 'Origem não permitida.', 'forbidden_origin');
      }
    }

    if (!PUBLIC_ROUTES.has(path)) {
      const user = await getSessionUser(env.DB, request);
      if (!user) return errorResponse(401, 'Faça login com o Discord.', 'unauthorized');
      context.data.user = user;
      context.data.tz = await resolveUserTimeZone(env.DB, user, request);
    }

    return await context.next();
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err.status, err.message, err.code);
    console.error('Erro não tratado em', path, err);
    return errorResponse(500, 'Erro interno no servidor.', 'internal');
  }
}
