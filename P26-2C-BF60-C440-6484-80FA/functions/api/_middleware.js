// Middleware de /api/*:
// - se nenhuma função atendeu e o Pages caiu no HTML estático, devolve 404 JSON
//   (um catch-all [[path]].js quebraria o 405 automático de método);
// - os 405 automáticos do Pages vêm sem corpo: converte para o formato de erro JSON.
import { errorResponse, methodNotAllowed } from "../../src/http.js";

export async function onRequest({ next }) {
  const res = await next();
  if (res.status === 405) {
    const out = methodNotAllowed();
    const allow = res.headers.get("Allow");
    if (allow) out.headers.set("Allow", allow);
    return out;
  }
  const ct = res.headers.get("Content-Type") || "";
  if (ct.startsWith("text/html")) return errorResponse(404, "not_found", "Rota não encontrada.");
  return res;
}
