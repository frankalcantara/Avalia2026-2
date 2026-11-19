// Utilitários HTTP: respostas JSON, cookies, CSRF e tratamento de erros.
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200, extraHeaders) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) headers.append(k, v);
  return new Response(JSON.stringify(data), { status, headers });
}

export const fail = (status, error, message) => json({ error, message }, status);

export function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'cache-control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
}

export function parseCookies(request) {
  const out = {};
  const raw = request.headers.get('cookie');
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export function serializeCookie(name, value, { maxAge, secure = true, httpOnly = true, sameSite = 'Lax', path = '/' } = {}) {
  let c = `${name}=${value}; Path=${path}; SameSite=${sameSite}`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  if (httpOnly) c += '; HttpOnly';
  if (secure) c += '; Secure';
  return c;
}

export const isHttps = (request) => new URL(request.url).protocol === 'https:';

/** Proteção CSRF: POST só é aceito se o Origin for exatamente a origem do site. */
export function checkOrigin(request) {
  const origin = request.headers.get('origin');
  return origin !== null && origin === new URL(request.url).origin;
}

export async function readJson(request) {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  if (!ct.startsWith('application/json')) {
    throw new HttpError(400, 'invalid_body', 'Content-Type deve ser application/json.');
  }
  const text = await request.text();
  if (text.length > 2048) throw new HttpError(400, 'invalid_body', 'Corpo da requisição muito grande.');
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_body', 'JSON inválido.');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'invalid_body', 'O corpo deve ser um objeto JSON.');
  }
  return value;
}

/** Envolve um handler: valida Origin nos POST e converte erros em respostas JSON. */
export function handle(fn, { post = false } = {}) {
  return async (context) => {
    try {
      if (post && !checkOrigin(context.request)) {
        throw new HttpError(403, 'bad_origin', 'Origem não permitida.');
      }
      return await fn(context);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.code, e.message);
      console.error('erro não tratado:', e);
      return fail(500, 'internal', 'Erro interno do servidor.');
    }
  };
}
