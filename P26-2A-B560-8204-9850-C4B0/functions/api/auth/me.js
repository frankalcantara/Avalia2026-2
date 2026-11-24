/**
 * Cloudflare Pages Function — `GET /api/auth/me`
 *
 * Devolve o usuário autenticado a partir do cookie de sessão assinado.
 * Sempre 200: `user: null` quando não há sessão válida (não é erro de aplicação).
 *
 * @module functions/api/auth/me
 */

import { fail, json } from "../_lib/http.js";
import { getSessionUser } from "../_lib/session.js";

/**
 * `GET /api/auth/me`
 *
 * @param {{ request: Request, env: Record<string, unknown> }} context Contexto do Pages Functions.
 * @returns {Promise<Response>} `{ ok:true, user }`.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const sessionUser = await getSessionUser(request, env);

  return json({
    ok: true,
    user: sessionUser
      ? {
          userId: sessionUser.userId,
          username: sessionUser.username,
          avatar: sessionUser.avatar,
        }
      : null,
  });
}

/**
 * Qualquer método diferente de GET → 405 em JSON.
 *
 * @returns {Response} 405 `method_not_allowed`.
 */
export function onRequest() {
  return fail(405, "method_not_allowed", "Método não permitido para este endpoint.");
}
