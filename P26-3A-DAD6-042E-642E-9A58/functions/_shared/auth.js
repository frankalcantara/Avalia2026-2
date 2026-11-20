import { HttpError } from "./http.js";
import { getSessionUser } from "./session.js";

// Origem pública configurada (sem barra final).
export function publicOrigin(env) {
  if (!env || typeof env.PUBLIC_BASE_URL !== "string" || !env.PUBLIC_BASE_URL) {
    throw new HttpError(500, "misconfigured", "Servidor sem configuração.");
  }
  try {
    return new URL(env.PUBLIC_BASE_URL).origin;
  } catch {
    throw new HttpError(500, "misconfigured", "Servidor sem configuração.");
  }
}

// Rotas que mudam estado exigem Origin igual a PUBLIC_BASE_URL (proteção CSRF).
export function assertOrigin(request, env) {
  const expected = publicOrigin(env);
  const origin = request.headers.get("Origin");
  if (!origin || origin !== expected) {
    throw new HttpError(403, "invalid_origin", "Origem da requisição não permitida.");
  }
}

export async function requireUser(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) throw new HttpError(401, "unauthenticated", "Faça login com o Discord para continuar.");
  return user;
}

// POST/DELETE: primeiro a origem (403), depois a sessão (401).
export async function requireMutation(request, env) {
  assertOrigin(request, env);
  return requireUser(request, env);
}
