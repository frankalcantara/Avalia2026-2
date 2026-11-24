export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const json = (value, status = 200) => Response.json(value, { status });

export function requireOrigin(request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    throw new HttpError(403, 'Origem da requisição não autorizada.');
  }
}

export async function readJson(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Envie os dados em formato JSON.');
  }
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 16384) throw new HttpError(413, 'A requisição excede o tamanho permitido.');
  const reader = request.body?.getReader();
  let text = '';
  let bytes = 0;
  const decoder = new TextDecoder();
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16384) {
        await reader.cancel();
        throw new HttpError(413, 'A requisição excede o tamanho permitido.');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  }
  let body;
  try { body = JSON.parse(text); } catch { throw new HttpError(400, 'JSON inválido.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Envie um objeto JSON.');
  return body;
}

export function stringField(value, label, max, required = true) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') throw new HttpError(400, `${label} deve ser texto.`);
  const clean = value.trim();
  if ((required && !clean) || clean.length > max || /\p{Cc}/u.test(clean.replace(/[\n\r\t]/g, ''))) {
    throw new HttpError(400, `${label} deve ter ${required ? 'de 1 a' : 'até'} ${max} caracteres válidos.`);
  }
  return clean;
}

export function enumField(value, options, label) {
  if (!options.includes(value)) throw new HttpError(400, `${label} inválido.`);
  return value;
}

export function assertKeys(body, allowed) {
  if (Object.keys(body).some(key => !allowed.includes(key))) {
    throw new HttpError(400, 'A requisição contém campos não permitidos.');
  }
}

export function safeResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  return new Response(response.body, { status: response.status, headers });
}
