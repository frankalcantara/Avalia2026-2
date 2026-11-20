/** Respostas HTTP padronizadas (JSON) e leitura segura do corpo da requisição. */

const BASE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers(BASE_HEADERS);
  for (const [k, v] of Object.entries(extraHeaders)) {
    if (Array.isArray(v)) v.forEach((item) => headers.append(k, item));
    else headers.set(k, v);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function error(status, message, code) {
  return json({ ok: false, error: code || httpCode(status), message }, status);
}

function httpCode(status) {
  return (
    {
      400: "bad_request",
      401: "unauthorized",
      403: "forbidden",
      404: "not_found",
      405: "method_not_allowed",
      409: "conflict",
      413: "payload_too_large",
      415: "unsupported_media_type",
      422: "unprocessable_entity",
      500: "internal_error",
    }[status] || "error"
  );
}

/** Lê JSON do corpo exigindo Content-Type correto e limite de tamanho. */
export async function readJson(request, maxBytes = 4096) {
  const type = request.headers.get("Content-Type") || "";
  if (!type.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: error(415, "Envie o corpo como application/json.") };
  }
  const text = await request.text();
  if (text.length > maxBytes) {
    return { ok: false, response: error(413, "Corpo da requisição muito grande.") };
  }
  try {
    const body = JSON.parse(text || "{}");
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false, response: error(400, "O corpo deve ser um objeto JSON.") };
    }
    return { ok: true, body };
  } catch {
    return { ok: false, response: error(400, "JSON malformado.") };
  }
}

export function redirect(location, extraHeaders = {}) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const [k, v] of Object.entries(extraHeaders)) {
    if (Array.isArray(v)) v.forEach((item) => headers.append(k, item));
    else headers.set(k, v);
  }
  return new Response(null, { status: 302, headers });
}

export function parseCookies(header) {
  const out = {};
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) {
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

export function cookie(name, value, { maxAge, path = "/", httpOnly = true, secure = true, sameSite = "Lax" } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  if (httpOnly) c += "; HttpOnly";
  if (secure) c += "; Secure";
  return c;
}
