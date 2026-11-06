/**
 * Middleware de todas as rotas /api/*
 * - garante que o binding D1 (env.DB) existe
 * - carrega o usuário logado (context.data.user)
 * - bloqueia escrita sem login (401) — a regra vale no servidor, não só na interface
 * - trata erros inesperados com JSON
 */
import { erro } from "../_lib/http.js";
import { usuarioDaSessao } from "../_lib/auth.js";

// Rotas que podem ser acessadas sem login
const PUBLICAS = [
  { method: "GET", path: /^\/api\/status\/?$/ },
  { method: "GET", path: /^\/api\/me\/?$/ },
  { method: "GET", path: /^\/api\/items\/?$/ },
  { method: "GET", path: /^\/api\/auth\/discord(\/callback)?\/?$/ },
  { method: "POST", path: /^\/api\/auth\/logout\/?$/ },
];

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DB) {
    return erro(500, "d1_nao_configurado", "O binding D1 'DB' não está configurado neste deploy.");
  }

  try {
    context.data.user = await usuarioDaSessao(request, env);
  } catch (e) {
    return erro(500, "d1_erro", "Falha ao consultar o banco. As migrações foram aplicadas?", String(e?.message || e));
  }

  const publica = PUBLICAS.some((r) => r.method === request.method && r.path.test(url.pathname));
  if (!publica && !context.data.user) {
    return erro(401, "nao_autenticado", "Faça login com o Discord para continuar.");
  }

  try {
    return await context.next();
  } catch (e) {
    console.error("Erro na API:", e);
    return erro(500, "erro_interno", "Erro interno no servidor.");
  }
}
