export function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export function errorResponse(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

export function requireDatabase(env) {
  if (!env.DB) return errorResponse("Banco de dados indisponível.", 503);
  return null;
}

export function isSameOrigin(request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

export async function readJson(request) {
  try {
    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().includes("application/json")) return null;
    return await request.json();
  } catch {
    return null;
  }
}
