import { HttpError, json, requireOrigin, readJson, assertKeys, safeResponse } from './http.js';
import { currentUser, startDiscord, finishDiscord, logout } from './auth.js';
import { listBooks, createBook, changeBook } from './books.js';
import { dashboard, createRequest, changeRequest } from './requests.js';

async function route(request, env) {
  if (!env.DB) throw new HttpError(503, 'O banco de dados ainda não foi configurado pelo responsável pelo site.');
  const path = new URL(request.url).pathname.replace(/\/$/, '');
  const method = request.method;
  if (!['GET','HEAD'].includes(method)) requireOrigin(request);
  const routes = {
    '/api/me': { GET: async () => json({user:await currentUser(request,env)}) },
    '/api/status': { GET: async () => {
      await env.DB.prepare('SELECT count(*) FROM users').first();
      return json({ok:true,projectId:24,d1Connected:true,discordOAuthConfigured:Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET)});
    } },
    '/api/auth/discord': { GET: () => startDiscord(request,env) },
    '/api/auth/discord/callback': { GET: () => finishDiscord(request,env) },
    '/api/logout': { POST: async () => { assertKeys(await readJson(request),[]); return logout(request,env); } },
    '/api/books': { GET: () => listBooks(request,env), POST: () => createBook(request,env) },
    '/api/dashboard': { GET: () => dashboard(request,env) },
    '/api/requests': { POST: () => createRequest(request,env) },
  };
  if (routes[path]) {
    if (!routes[path][method]) throw new HttpError(405, 'Método não permitido.');
    return routes[path][method]();
  }
  const bookRoute = /^\/api\/books\/([^/]+)$/.exec(path);
  if (bookRoute) {
    if (!['PATCH','DELETE'].includes(method)) throw new HttpError(405, 'Método não permitido.');
    return changeBook(request,env,bookRoute[1]);
  }
  const requestRoute = /^\/api\/requests\/([^/]+)$/.exec(path);
  if (requestRoute) {
    if (method !== 'PATCH') throw new HttpError(405, 'Método não permitido.');
    return changeRequest(request,env,requestRoute[1]);
  }
  throw new HttpError(404, 'Rota não encontrada.');
}

export async function handleApi(request, env) {
  try {
    return safeResponse(await route(request,env));
  } catch (error) {
    if (error instanceof HttpError) return safeResponse(json({error:error.message},error.status));
    const message = String(error?.message || '');
    if (/book_unavailable|offered_book_unavailable|book_busy|UNIQUE constraint failed: book_locks/i.test(message)) {
      return safeResponse(json({error:'Um dos livros acabou de ser reservado ou não está mais disponível. Atualize a página.'},409));
    }
    if (/invalid_transition/i.test(message)) return safeResponse(json({error:'A situação do pedido mudou. Atualize a página.'},409));
    if (/invalid_due_date|CHECK constraint failed/i.test(message)) return safeResponse(json({error:'Os dados não atendem às regras do projeto.'},400));
    if (/no such table/i.test(message)) return safeResponse(json({error:'O banco de dados precisa receber as migrações do projeto.'},503));
    // Nunca registrar cookies, códigos OAuth, Client Secret ou corpos de requisição.
    const incident = crypto.randomUUID();
    console.error(JSON.stringify({event:'api_failure',incident}));
    return safeResponse(json({error:`Não foi possível concluir a operação. Tente novamente. Referência: ${incident}`},500));
  }
}
