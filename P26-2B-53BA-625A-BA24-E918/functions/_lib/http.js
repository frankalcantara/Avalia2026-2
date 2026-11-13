export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}

export function errorResponse(error) {
  if (error instanceof HttpError) {
    return json({ error: error.code, message: error.message }, error.status);
  }
  console.error("Unhandled API error", error);
  return json({ error: "internal_error", message: "Erro interno." }, 500);
}

export function methodNotAllowed(allowed) {
  return json(
    { error: "method_not_allowed", message: "Método não permitido." },
    405,
    { Allow: allowed.join(", ") },
  );
}

export async function readJson(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "Envie um corpo application/json.");
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 32_768) {
    throw new HttpError(413, "payload_too_large", "O corpo excede o limite permitido.");
  }
  let raw;
  try {
    raw = await request.text();
  } catch {
    throw new HttpError(400, "invalid_json", "Não foi possível ler o corpo JSON.");
  }
  if (new TextEncoder().encode(raw).byteLength > 32_768) {
    throw new HttpError(413, "payload_too_large", "O corpo excede o limite permitido.");
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "invalid_json", "O corpo JSON é inválido.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_payload", "O corpo deve ser um objeto JSON.");
  }
  return value;
}

export function requireKeys(payload, allowed) {
  const unknown = Object.keys(payload).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    throw new HttpError(400, "unknown_fields", `Campo não permitido: ${unknown[0]}.`);
  }
}

export function requiredText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new HttpError(400, "invalid_payload", `${field} deve ser um texto de 1 a ${maxLength} caracteres.`);
  }
  return value.trim();
}

export function optionalLink(value) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) {
    throw new HttpError(400, "invalid_payload", "link deve ser uma URL HTTP(S) de até 2048 caracteres ou null.");
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw new HttpError(400, "invalid_payload", "link deve ser uma URL HTTP(S) válida ou null.");
  }
  return value;
}

export function parsePostId(value) {
  if (!/^[1-9]\d*$/.test(String(value))) {
    throw new HttpError(400, "invalid_post_id", "O id da publicação é inválido.");
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new HttpError(400, "invalid_post_id", "O id da publicação é inválido.");
  return id;
}

export function requiredCourseCode(value) {
  return requiredText(value, "course_code", 64);
}
