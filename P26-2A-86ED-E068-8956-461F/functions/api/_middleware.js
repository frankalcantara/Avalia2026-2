import { erro } from "../_lib/http.js";

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function onRequest(contexto) {
  const { request } = contexto;
  if (!METODOS_SEGUROS.has(request.method)) {
    const origem = request.headers.get("origin");
    if (origem && origem !== new URL(request.url).origin) {
      return erro("Origem da requisição não permitida.", 403);
    }
  }
  return contexto.next();
}
