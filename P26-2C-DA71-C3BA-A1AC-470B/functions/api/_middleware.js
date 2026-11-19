// Middleware de /api/*: 404 JSON quando a requisição caiu no estático e 500 JSON em exceções.
import { error } from "../_lib/http.js";

// Rotas que só exportam onRequestPost (correção do defeito D1 do relatório de validação).
const POST_ONLY = new Set(["/api/checkout", "/api/auth/logout"]);

export async function onRequest(context) {
  let response;
  try {
    response = await context.next();
  } catch (err) {
    console.error("Erro não tratado em", context.request.url, err);
    return error(500, "internal_error", "Erro interno no servidor.");
  }
  // Nenhuma Function casou: o Pages serviu HTML estático (SPA fallback).
  const type = response.headers.get("Content-Type") || "";
  if (type.includes("text/html")) {
    // GET/HEAD numa rota só-POST também cai no estático: aqui é 405, não 404.
    const path = new URL(context.request.url).pathname.replace(/\/+$/, "");
    if (POST_ONLY.has(path)) {
      return error(405, "method_not_allowed", "Método não suportado nesta rota.", {}, { Allow: "POST" });
    }
    return error(404, "not_found", "Rota da API não encontrada.");
  }
  // 405 automático do Pages vem sem corpo: padroniza em JSON mantendo o status.
  if (response.status === 405 && !type.includes("application/json")) {
    const allow = response.headers.get("Allow");
    return error(405, "method_not_allowed", "Método não suportado nesta rota.", {}, allow ? { Allow: allow } : {});
  }
  return response;
}
