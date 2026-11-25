/**
 * Helpers HTTP, JSON e Cookies para Cloudflare Pages Functions e Node.js 24.
 */

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });

  if (extraHeaders instanceof Headers) {
    for (const [key, value] of extraHeaders.entries()) {
      headers.append(key, value);
    }
  } else if (Array.isArray(extraHeaders)) {
    for (const [key, value] of extraHeaders) {
      headers.append(key, value);
    }
  } else if (extraHeaders && typeof extraHeaders === "object") {
    for (const [key, value] of Object.entries(extraHeaders)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          headers.append(key, String(item));
        }
      } else if (value !== undefined && value !== null) {
        headers.set(key, String(value));
      }
    }
  }

  return new Response(JSON.stringify(data), { status, headers });
}

export function errorResponse(message, code = "BAD_REQUEST", status = 400, extraHeaders = {}) {
  return jsonResponse(
    {
      ok: false,
      error: message,
      code,
    },
    status,
    extraHeaders
  );
}

export async function parseJsonBody(request) {
  try {
    const data = await request.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {
        ok: false,
        error: "O corpo da requisição deve ser um objeto JSON válido.",
      };
    }
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: "JSON malformado no corpo da requisição.",
    };
  }
}

export function parseCookies(request) {
  const cookieHeader = request?.headers?.get("Cookie") || "";
  const cookies = {};

  if (!cookieHeader) {
    return cookies;
  }

  const pairs = cookieHeader.split(";");
  for (const rawPair of pairs) {
    const eqIndex = rawPair.indexOf("=");
    if (eqIndex <= 0) continue;

    const name = rawPair.slice(0, eqIndex).trim();
    const rawValue = rawPair.slice(eqIndex + 1).trim();
    if (!name) continue;

    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }

  return cookies;
}

export function buildCookie(name, value, options = {}) {
  const {
    httpOnly = true,
    sameSite = "Lax",
    path = "/",
    maxAge,
    expires,
    secure = false,
  } = options;

  const parts = [`${name}=${encodeURIComponent(String(value ?? ""))}`];

  if (path) {
    parts.push(`Path=${path}`);
  }
  if (httpOnly) {
    parts.push("HttpOnly");
  }
  if (sameSite) {
    parts.push(`SameSite=${sameSite}`);
  }
  if (typeof maxAge === "number" && Number.isFinite(maxAge)) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  }
  if (expires instanceof Date) {
    parts.push(`Expires=${expires.toUTCString()}`);
  }
  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function isHttpsRequest(request) {
  if (!request) return false;

  const forwardedProto = request.headers?.get("X-Forwarded-Proto");
  if (forwardedProto) {
    const firstProto = forwardedProto.split(",")[0].trim().toLowerCase();
    if (firstProto === "https") return true;
    if (firstProto === "http") return false;
  }

  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}
