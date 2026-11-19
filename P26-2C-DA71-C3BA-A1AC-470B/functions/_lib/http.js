// Helpers de resposta HTTP (sempre JSON, exceto redirecionamentos).

const JSON_TYPE = "application/json; charset=utf-8";

// Resposta JSON com status e headers opcionais.
export function json(data, status = 200, headers = {}) {
  const h = new Headers(headers);
  h.set("Content-Type", JSON_TYPE);
  h.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: h });
}

// Erro no formato { ok:false, error, message, ...extra }.
export function error(status, code, message, extra = {}, headers = {}) {
  return json({ ok: false, error: code, message, ...extra }, status, headers);
}

// Redirecionamento 302 com Set-Cookie opcionais (aceita vários).
export function redirect(location, cookies = []) {
  const h = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const c of cookies) h.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers: h });
}

// Verifica o header Origin: se presente, deve ser a mesma origem da requisição.
export function checkOrigin(request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return error(403, "forbidden_origin", "Origem da requisição não permitida.");
  }
  return null;
}
