export function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function apiError(status, code, message) {
  return json({ error: { code, message } }, status);
}

export async function readJson(request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export function parseId(value) {
  if (!/^[1-9]\d*$/.test(String(value ?? ""))) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function serverError(scope, error) {
  console.error(`[${scope}]`, error);
  return apiError(500, "internal_error", "Ocorreu um erro interno. Tente novamente.");
}

export function missingDatabase() {
  return apiError(503, "database_unavailable", "O banco D1 não está configurado.");
}
