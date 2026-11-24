import { json } from "../_lib/http.js";

/** Catch-all: qualquer /api/* sem rota própria responde 404 JSON (em vez do HTML do SPA). */
export async function onRequest() {
  return json({ ok: false, error: "not_found" }, 404);
}
