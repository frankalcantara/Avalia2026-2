/**
 * Cloudflare Pages Function — fallback de /api/*
 *
 * Qualquer rota /api/* que não tenha um handler dedicado (ex.: /api/inexistente)
 * responde 404 em JSON, em vez de cair no index.html do site.
 *
 * As rotas mais específicas (`/api/status`, `/api/cards`, `/api/cards/[id]`,
 * `/api/auth/discord`, `/api/auth/discord/callback`, `/api/auth/logout`)
 * continuam tendo prioridade no roteador de Pages Functions.
 */

import { json } from "./_lib/kanban.js";

export function onRequest() {
  return json({ ok: false, error: "not_found" }, 404);
}
