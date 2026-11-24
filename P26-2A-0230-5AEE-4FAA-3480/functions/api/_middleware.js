import { HttpError, json } from "../_lib/http.js";

export async function onRequest(context) {
  const { request } = context;
  try {
    if (request.method === "POST" && request.headers.get("Origin") !== new URL(request.url).origin) {
      throw new HttpError(403, "A requisição precisa vir da página do almoxarifado.");
    }
    return await context.next();
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message }, error.status);
    }
    console.error("Erro em", request.method, new URL(request.url).pathname, error);
    return json({ error: "O almoxarifado não conseguiu processar a solicitação. Tente novamente." }, 500);
  }
}
