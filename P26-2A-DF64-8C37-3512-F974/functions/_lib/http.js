// Utilitários HTTP compartilhados pelas Cloudflare Pages Functions.

export class HttpError extends Error {
  constructor(status, message, code = 'error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  for (const [k, v] of Object.entries(extraHeaders)) headers.append(k, v);
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorResponse(status, message, code = 'error') {
  return json({ error: code, message }, status);
}

export function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'cache-control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
}

export function parseCookies(request) {
  const header = request.headers.get('cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

export function serializeCookie(name, value, { maxAge, path = '/', httpOnly = true, sameSite = 'Lax' } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}; Secure`;
  if (httpOnly) c += '; HttpOnly';
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  return c;
}

export async function readJson(request, maxBytes = 256 * 1024) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    throw new HttpError(415, 'Envie o corpo como JSON.', 'unsupported_media_type');
  }
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Requisição grande demais.', 'payload_too_large');
  try {
    const data = JSON.parse(text);
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('not object');
    return data;
  } catch {
    throw new HttpError(400, 'JSON inválido.', 'invalid_json');
  }
}

export function parseId(value) {
  const s = String(value ?? '');
  if (!/^\d{1,12}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

export function nowIso() {
  return new Date().toISOString();
}
