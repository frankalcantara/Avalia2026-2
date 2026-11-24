// Respostas padronizadas. Tudo o que sai das Functions usa Cache-Control: no-store
// e erros no formato { error, message } em português.

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.publicMessage = message;
    this.extra = extra;
  }
}

export function json(status, body, cookies = []) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(status, code, message, extra = {}, cookies = []) {
  return json(status, { error: code, message, ...extra }, cookies);
}

export function noContent(cookies = []) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 204, headers });
}

export function redirect(location, cookies = [], status = 302) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status, headers });
}

export function methodNotAllowed(allow) {
  const response = errorResponse(405, "method_not_allowed", "Método não permitido nesta rota.");
  response.headers.set("Allow", allow);
  return response;
}

// Envolve um handler: HttpError vira resposta JSON; qualquer outra falha vira 500
// e só o nome interno da rota é registrado (nunca tokens, cookies ou corpos).
export function handle(routeName, fn) {
  return async (context) => {
    try {
      return await fn(context);
    } catch (error) {
      if (error instanceof HttpError) {
        return errorResponse(error.status, error.code, error.publicMessage, error.extra);
      }
      console.error(`${routeName}: unexpected_error`);
      return errorResponse(500, "internal", "Erro interno. Tente novamente.");
    }
  };
}

// Lê o corpo JSON com limite de tamanho. Sempre devolve um objeto simples.
export async function readJsonBody(request, maxBytes = 16384) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new HttpError(400, "validation", "Corpo da requisição grande demais.", { fields: {} });
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, "validation", "Corpo da requisição não é um JSON válido.", { fields: {} });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "validation", "O corpo deve ser um objeto JSON.", { fields: {} });
  }
  return body;
}

// Converte o parâmetro :id da rota em inteiro positivo; senão 404.
export function parseId(raw) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !/^[1-9][0-9]{0,14}$/.test(value)) {
    throw new HttpError(404, "not_found", "Evento não encontrado.");
  }
  return Number(value);
}
