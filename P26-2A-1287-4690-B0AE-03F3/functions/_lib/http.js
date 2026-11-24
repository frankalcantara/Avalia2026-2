// Helpers HTTP compartilhados.
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function error(message, status = 400, headers = {}) {
  return json({ error: message }, status, headers);
}

export function redirect(location, status = 302, extraHeaders = []) {
  const headers = new Headers({ Location: location });
  for (const [k, v] of extraHeaders) headers.append(k, v);
  return new Response(null, { status, headers });
}

export function parseCookies(request) {
  const out = {};
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export function isLocalhost(request) {
  const h = new URL(request.url).hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
}

export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}
