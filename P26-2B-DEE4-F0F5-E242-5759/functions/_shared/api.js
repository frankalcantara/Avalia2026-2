import { sessionUser } from "./session.js";

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function error(code, status) {
  return json({ ok: false, error: code }, status);
}

export function withDb(handler, authenticated = false) {
  return async (context) => {
    const { request, env } = context;
    const origin = request.headers.get("Origin");
    if (request.method !== "GET" && origin && origin !== new URL(request.url).origin) {
      return error("origem_invalida", 403);
    }
    if (!env.DB) return error("banco_indisponivel", 503);
    try {
      const user = authenticated ? await sessionUser(request, env) : null;
      if (authenticated && !user) return error("autenticacao_necessaria", 401);
      return await handler(context, user);
    } catch (err) {
      console.error("Falha na operação com D1", err);
      return error("falha_interna", 500);
    }
  };
}
