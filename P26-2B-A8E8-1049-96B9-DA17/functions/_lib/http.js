/** Helpers HTTP compartilhados (sem rota própria: não exporta onRequest*). */
export const MAX_BODY_BYTES = 32 * 1024;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      ...headers,
    },
  });
}

export const fail = (status, error, fields) =>
  json(fields ? { ok: false, error, fields } : { ok: false, error }, status);

export const methodNotAllowed = (allow) =>
  json({ ok: false, error: "Método não permitido." }, 405, { Allow: allow.join(", ") });

export function isHttps(request) {
  return new URL(request.url).protocol === "https:";
}

/** Lê o JSON do corpo: exige application/json, limita o tamanho. Retorna {body} ou {response}. */
export async function readJson(request, maxBytes = MAX_BODY_BYTES) {
  const ct = (request.headers.get("Content-Type") || "").toLowerCase();
  if (!ct.startsWith("application/json")) {
    return { response: fail(415, "Content-Type deve ser application/json.") };
  }
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > maxBytes) return { response: fail(413, "Corpo da requisição grande demais.") };
  let raw;
  try {
    raw = await request.text();
  } catch {
    return { response: fail(400, "Corpo inválido.") };
  }
  if (new TextEncoder().encode(raw).length > maxBytes) {
    return { response: fail(413, "Corpo da requisição grande demais.") };
  }
  try {
    const body = JSON.parse(raw);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return { response: fail(400, "O corpo deve ser um objeto JSON.") };
    }
    return { body };
  } catch {
    return { response: fail(400, "JSON inválido.") };
  }
}

/** Defesa extra de CSRF para mutações: se houver Origin, deve ser a mesma origem. */
export function sameOriginOk(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}
