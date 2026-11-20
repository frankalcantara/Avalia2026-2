/** Qualquer rota /api/* inexistente (ou método não suportado) responde 404 em JSON, nunca o HTML da página. */
import { error } from "../../src/lib/http.js";

export function onRequest() {
  return error(404, "Rota da API não encontrada.");
}
