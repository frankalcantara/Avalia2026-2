/**
 * Helpers HTTP compartilhados pelas rotas da API.
 */
import { getSessionUser } from "./session.js";

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(status, error) {
  return json({ ok: false, error }, status);
}

// Exige login. Devolve { user } se houver sessão válida, ou { response } com o 401 pronto.
export async function requireUser(context) {
  const user = await getSessionUser(context.env, context.request);
  if (!user) return { response: fail(401, "Login obrigatório.") };
  return { user };
}

// Converte o :id da URL em inteiro positivo; devolve null se for inválido.
export function parseGameId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}
