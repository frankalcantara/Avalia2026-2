/**
 * Helpers de resposta HTTP compartilhados pelas Pages Functions.
 */

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function methodNotAllowed(allowed) {
  return json({ error: "Método não suportado" }, 405, { Allow: allowed });
}

// Response.redirect() tem headers imutáveis; aqui dá para anexar Set-Cookie.
export function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}