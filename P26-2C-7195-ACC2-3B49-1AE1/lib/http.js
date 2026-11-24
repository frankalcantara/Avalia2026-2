// Helpers de resposta/validação HTTP compartilhados pelas Pages Functions.

export function json(data, status = 200, headers = new Headers()) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers });
}

export function fail(status, message, code = String(status)) {
  return json({ error: { code, message } }, status);
}

export function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
}

/** Valida o :id da rota; retorna inteiro positivo ou null. */
export function parseHabitId(value) {
  return /^[1-9]\d{0,14}$/.test(String(value)) ? Number(value) : null;
}

/** Proteção CSRF: requisições que alteram estado precisam vir da mesma origem. */
export function isSameOrigin(request) {
  const origin = request.headers.get('Origin');
  return origin !== null && origin === new URL(request.url).origin;
}

/** Lê e valida o corpo JSON. Retorna { body } ou { error: Response }. */
export async function readJsonBody(request, maxChars = 4096) {
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!type.startsWith('application/json')) {
    return { error: fail(415, 'Use Content-Type: application/json.', 'unsupported_media_type') };
  }
  const text = await request.text();
  if (text.length > maxChars) return { error: fail(413, 'Corpo da requisição grande demais.', 'payload_too_large') };
  try {
    const body = JSON.parse(text);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
    return { body };
  } catch {
    return { error: fail(400, 'JSON inválido.', 'invalid_json') };
  }
}
