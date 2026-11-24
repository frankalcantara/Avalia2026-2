/** Qualquer /api/* sem rota própria → 404 JSON (em vez de cair no conteúdo estático). */
import { erro } from "../_lib/http.js";

export async function onRequest() {
  return erro(404, "nao_encontrado", "Rota da API não encontrada.");
}
