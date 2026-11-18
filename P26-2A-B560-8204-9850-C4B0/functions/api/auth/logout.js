/**
 * Cloudflare Pages Function — `POST /api/auth/logout`
 *
 * Expira o cookie de sessão (`Max-Age=0`) e confirma o encerramento.
 * Como a sessão é stateless, nenhuma escrita no D1 é necessária.
 *
 * @module functions/api/auth/logout
 */

import { fail, json } from "../_lib/http.js";
import { SESSION_COOKIE, serializeCookie } from "../_lib/session.js";

/**
 * `POST /api/auth/logout`
 *
 * @returns {Response} `{ ok:true }` com `Set-Cookie` expirando a sessão.
 */
export function onRequestPost() {
  const headers = new Headers();
  headers.append("Set-Cookie", serializeCookie(SESSION_COOKIE, "", { maxAge: 0 }));

  return json({ ok: true }, 200, headers);
}

/**
 * Qualquer método diferente de POST → 405 em JSON.
 *
 * @returns {Response} 405 `method_not_allowed`.
 */
export function onRequest() {
  return fail(405, "method_not_allowed", "Use POST para encerrar a sessão.");
}
