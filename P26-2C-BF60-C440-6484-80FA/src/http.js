// Utilitários HTTP compartilhados pelas rotas em functions/api/**.
// Respostas JSON padronizadas, erros { error, message }, leitura segura do corpo.

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

// Erro de negócio com status HTTP do contrato; capturado por route().
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200, extraHeaders) {
  const headers = new Headers(JSON_HEADERS);
  if (extraHeaders) {
    for (const [k, v] of extraHeaders instanceof Headers ? extraHeaders.entries() : Object.entries(extraHeaders)) {
      headers.append(k, v);
    }
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorResponse(status, code, message) {
  return json({ error: code, message }, status);
}

// 405 em JSON (rotas só-POST exportam isto como onRequestGet; o middleware usa para os 405 automáticos).
export function methodNotAllowed() {
  return errorResponse(405, "method_not_allowed", "Método não permitido nesta rota.");
}

// Envolve um handler: converte HttpError em resposta JSON e esconde erros internos
// (nunca vaza stack trace; registra com console.error).
export function route(handler) {
  return async (context) => {
    try {
      if (isWrite(context.request.method)) checkOrigin(context.request);
      return await handler(context);
    } catch (err) {
      if (err instanceof HttpError) return errorResponse(err.status, err.code, err.message);
      if (isUniqueViolation(err)) {
        return errorResponse(409, "conflict", "Conflito de estado: já existe um pedido pendente para este livro.");
      }
      console.error("Erro interno:", err && err.stack ? err.stack : err);
      return errorResponse(500, "internal_error", "Erro interno do servidor.");
    }
  };
}

function isWrite(method) {
  return method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE";
}

// Defesa CSRF extra: se o navegador enviou Origin, ele precisa ser o próprio site.
function checkOrigin(request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError(403, "bad_origin", "Origem da requisição não permitida.");
  }
}

export function isUniqueViolation(err) {
  const msg = String((err && (err.message || err.cause?.message)) || "");
  return msg.includes("UNIQUE constraint failed");
}

function hasBody(request) {
  const len = request.headers.get("Content-Length");
  if (len !== null) return Number(len) > 0;
  return request.body !== null && request.headers.has("Transfer-Encoding");
}

// Lê corpo JSON obrigatório: Content-Type errado → 415; JSON inválido ou não-objeto → 400.
export async function readJson(request, { optional = false } = {}) {
  if (optional && !hasBody(request) && !request.headers.has("Content-Type")) return {};
  // Compara o media type inteiro (application/jsonx, application/json-patch+json etc. → 415).
  const mediaType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new HttpError(415, "unsupported_media_type", "Envie o corpo como application/json.");
  }
  let text;
  try {
    text = await request.text();
  } catch {
    throw new HttpError(400, "invalid_json", "Corpo da requisição ilegível.");
  }
  if (optional && text.trim() === "") return {};
  if (text.length > 20000) throw new HttpError(400, "body_too_large", "Corpo da requisição grande demais.");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "JSON inválido no corpo da requisição.");
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpError(400, "invalid_json", "O corpo deve ser um objeto JSON.");
  }
  return data;
}

// Para POSTs de ação sem corpo (reject/cancel/return/logout): se vier corpo, ele precisa ser JSON.
export async function ensureJsonIfBody(request) {
  await readJson(request, { optional: true });
}
