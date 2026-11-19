import { fail, json, methodNotAllowed } from "../../_lib/http.js";
import { SELECT_QUOTE, toQuote } from "../../_lib/quotes.js";

// Pública (sem login): sorteia apenas entre citações PÚBLICAS.
export async function onRequest({ request, env }) {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  try {
    const row = await env.DB.prepare(`${SELECT_QUOTE} WHERE q.is_public = 1 ORDER BY RANDOM() LIMIT 1`).first();
    return json({ ok: true, quote: row ? toQuote(row) : null });
  } catch {
    return fail(500, "Erro interno ao consultar o acervo.");
  }
}
