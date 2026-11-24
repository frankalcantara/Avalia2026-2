/** Utilitários HTTP compartilhados pelas Pages Functions. */

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function fail(status, error, extra = {}) {
  return json({ ok: false, error, ...extra }, status);
}

/** Lê JSON do corpo com limite de tamanho; devolve null se inválido. */
export async function readJson(request, maxBytes = 16 * 1024) {
  const type = request.headers.get("Content-Type") || "";
  if (!type.toLowerCase().includes("application/json")) return null;
  const text = await request.text();
  if (text.length > maxBytes) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Proteção CSRF simples para requisições que alteram dados:
 * o navegador sempre envia Origin em POST/PATCH via fetch; ele precisa bater com o host.
 */
export function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function requireDb(env) {
  if (!env.DB) {
    return fail(503, "Banco D1 não vinculado. Adicione o binding DB em Settings → Functions → D1 database bindings.");
  }
  return null;
}
