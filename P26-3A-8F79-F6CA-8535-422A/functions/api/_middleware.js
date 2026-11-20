import { HttpError, error } from "../_lib.js";

// Converte HttpError na resposta JSON combinada; qualquer outro erro vira 500 genérico (sem stack/SQL).
export async function onRequest({ next }) {
  try {
    return await next();
  } catch (err) {
    if (err instanceof HttpError) return error(err.status, err.message);
    console.error(err);
    return error(500, "Erro interno.");
  }
}
