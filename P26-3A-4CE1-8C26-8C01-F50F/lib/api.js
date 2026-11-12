import { isSameOrigin, requireUser } from "./auth.js";

export const COLLECTION_FIELDS = ["id", "name", "is_public", "created_at", "updated_at"];
export const BOOKMARK_FIELDS = ["id", "collection_id", "url", "title", "summary", "status", "created_at", "updated_at"];
const STATUSES = new Set(["para_ler", "lendo", "concluido"]);
const MAX_BODY_BYTES = 32 * 1024;

class ApiError extends Error {
  constructor(status, code, message, fields, headers = {}) {
    super(message);
    Object.assign(this, { status, code, fields, headers });
  }
}

export function fail(status, code, message, fields, headers) {
  throw new ApiError(status, code, message, fields, headers);
}

function invalidField(field, message) {
  fail(400, "invalid_field", message, { [field]: message });
}

export function data(value, status = 200) {
  return Response.json({ data: value }, {
    status, headers: { "Cache-Control": "no-store" },
  });
}

export function deleted() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

// Os handlers novos adaptam o contrato de erro sem modificar a autenticação existente.
export function route(methods, handler, { public: isPublic = false } = {}) {
  return async (context) => {
    try {
      if (!methods.includes(context.request.method)) {
        fail(405, "method_not_allowed", "Método não permitido.", undefined, { Allow: methods.join(", ") });
      }
      if (!isPublic) {
        const authError = requireUser(context);
        if (authError) {
          if (authError.status === 401) fail(401, "unauthenticated", "Autenticação obrigatória.");
          fail(503, "database_unavailable", "Não foi possível validar a sessão.");
        }
      }
      if (["POST", "PATCH", "DELETE"].includes(context.request.method) && !isSameOrigin(context.request)) {
        fail(403, "invalid_origin", "Origem não permitida.");
      }
      if (!context.env.DB) fail(503, "database_unavailable", "Banco de dados indisponível.");
      return await handler(context);
    } catch (error) {
      let failure = error;
      if (!(failure instanceof ApiError)) {
        if (/UNIQUE constraint failed/i.test(String(error?.message))) {
          failure = new ApiError(409, "conflict", "Já existe um recurso com esses dados.");
        } else if (/FOREIGN KEY constraint failed/i.test(String(error?.message))) {
          failure = new ApiError(409, "conflict", "O recurso está em uso ou foi alterado.");
        } else {
          failure = new ApiError(500, "internal_error", "Não foi possível concluir a solicitação.");
        }
      }
      const payload = { code: failure.code, message: failure.message };
      if (failure.fields !== undefined) payload.fields = failure.fields;
      return Response.json({ error: payload }, {
        status: failure.status,
        headers: { "Cache-Control": "no-store", ...failure.headers },
      });
    }
  };
}

export function columns(fields, alias = "") {
  return fields.map((field) => `${alias ? `${alias}.` : ""}${field}`).join(", ");
}

export function collectionData(row) {
  return { ...Object.fromEntries(COLLECTION_FIELDS.map((key) => [key, row[key]])), is_public: row.is_public === 1 };
}

export function bookmarkData(row) {
  return Object.fromEntries(BOOKMARK_FIELDS.map((key) => [key, row[key]]));
}

export function found(row) {
  if (!row) fail(404, "not_found", "Recurso não encontrado.");
  return row;
}

export function uuid(value, field = "id") {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) {
    invalidField(field, "Informe um UUID válido.");
  }
  return value.toLowerCase();
}

export function query(request, allowed = []) {
  const params = new URL(request.url).searchParams;
  const seen = new Set();
  for (const [key] of params) {
    if (!allowed.includes(key)) invalidField(key, "Parâmetro desconhecido.");
    if (seen.has(key)) invalidField(key, "Parâmetro repetido.");
    seen.add(key);
  }
  return params;
}

export function limit(params) {
  const value = params.get("limit");
  if (value === null) return 100;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 100) {
    invalidField("limit", "O limite deve ser um inteiro entre 1 e 100.");
  }
  return Number(value);
}

export function status(value) {
  if (!STATUSES.has(value)) invalidField("status", "Status inválido: use para_ler, lendo ou concluido.");
  return value;
}

async function readJson(request) {
  const length = request.headers.get("Content-Length");
  if (length && /^\d+$/.test(length) && Number(length) > MAX_BODY_BYTES) {
    fail(413, "body_too_large", "O corpo deve ter no máximo 32 KiB.");
  }
  const mediaType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") fail(415, "unsupported_media_type", "Use Content-Type: application/json.");
  if (!request.body) fail(400, "invalid_json", "Envie um objeto JSON.");

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        fail(413, "body_too_large", "O corpo deve ter no máximo 32 KiB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  let body;
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(400, "invalid_json", "JSON inválido.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) fail(400, "invalid_json", "Envie um objeto JSON.");
  return body;
}

function checkFields(body, allowed, required, partial) {
  const keys = Object.keys(body);
  const unknown = keys.filter((key) => !allowed.includes(key));
  if (unknown.length) {
    fail(400, "unknown_fields", "Existem campos desconhecidos.",
      Object.fromEntries(unknown.map((key) => [key, "Campo não permitido."])));
  }
  if (partial && !keys.length) fail(400, "empty_patch", "Informe ao menos um campo para atualizar.");
  if (!partial) {
    for (const key of required) {
      if (!Object.hasOwn(body, key)) invalidField(key, "Campo obrigatório.");
    }
  }
}

function text(value, field, min, max, trim = false) {
  if (typeof value !== "string") invalidField(field, "O campo deve ser texto.");
  const result = trim ? value.trim() : value;
  const length = Array.from(result).length;
  if (length < min || length > max) invalidField(field, `O campo deve ter entre ${min} e ${max} caracteres.`);
  return result;
}

function url(value) {
  const result = text(value, "url", 1, 2048, true);
  try {
    const parsed = new URL(result);
    if (!/^https?:\/\//i.test(result) || !["http:", "https:"].includes(parsed.protocol)
      || !parsed.hostname || parsed.username || parsed.password || /[\u0000-\u001f\u007f]/.test(result)) {
      throw new Error("URL inválida");
    }
  } catch {
    invalidField("url", "Use uma URL absoluta http/https, sem credenciais.");
  }
  return result;
}

export async function collectionBody(request, partial = false) {
  const body = await readJson(request);
  checkFields(body, ["name", "is_public"], ["name"], partial);
  const result = {};
  if (Object.hasOwn(body, "name")) result.name = text(body.name, "name", 1, 80, true);
  if (Object.hasOwn(body, "is_public")) {
    if (typeof body.is_public !== "boolean") invalidField("is_public", "O campo deve ser booleano.");
    result.is_public = body.is_public;
  } else if (!partial) result.is_public = false;
  return result;
}

export async function bookmarkBody(request, partial = false) {
  const body = await readJson(request);
  checkFields(body, ["url", "title", "summary", "collection_id", "status"], ["url", "title", "collection_id"], partial);
  const result = {};
  if (Object.hasOwn(body, "url")) result.url = url(body.url);
  if (Object.hasOwn(body, "title")) result.title = text(body.title, "title", 1, 200, true);
  if (Object.hasOwn(body, "summary")) result.summary = text(body.summary, "summary", 0, 2000);
  else if (!partial) result.summary = "";
  if (Object.hasOwn(body, "collection_id")) result.collection_id = uuid(body.collection_id, "collection_id");
  if (Object.hasOwn(body, "status")) result.status = status(body.status);
  else if (!partial) result.status = "para_ler";
  return result;
}
