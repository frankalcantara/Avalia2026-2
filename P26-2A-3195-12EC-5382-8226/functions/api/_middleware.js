/**
 * Middleware de todas as rotas /api/*:
 * 1. bloqueia requisições que alteram dados vindas de outra origem (CSRF);
 * 2. confere se o binding do D1 existe;
 * 3. carrega o usuário da sessão em context.data.user;
 * 4. converte exceções em JSON 500 sem vazar detalhes internos.
 */
import { error } from "../../src/lib/http.js";
import { getSessionUser } from "../../src/lib/session.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (!SAFE_METHODS.has(request.method)) {
      const origin = request.headers.get("Origin");
      if (origin && origin !== new URL(request.url).origin) {
        return error(403, "Origem da requisição não permitida.");
      }
    }

    if (!env.DB) {
      return error(500, "Banco D1 não configurado: crie o binding 'DB' no Cloudflare Pages.", "d1_not_configured");
    }

    context.data.user = await getSessionUser(env.DB, request);
    return await context.next();
  } catch (err) {
    console.error("[api] erro não tratado:", err && err.stack ? err.stack : err);
    return error(500, "Erro interno no servidor.");
  }
}
