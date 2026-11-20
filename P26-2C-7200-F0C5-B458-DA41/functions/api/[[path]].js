/** Qualquer /api/* que não exista devolve 404 em JSON (em vez do index.html). */
import { fail } from "../_lib/http.js";

export function onRequest() {
  return fail(404, "Rota da API não encontrada.");
}
