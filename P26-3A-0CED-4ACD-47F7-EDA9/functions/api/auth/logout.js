/**
 * POST /api/auth/logout
 * Remove a sessão do D1 e apaga o cookie.
 */
import { json, methodNotAllowed } from "../../../src/http.js";
import { destroySession } from "../../../src/session.js";

export async function onRequestPost({ request, env }) {
  const clear = await destroySession(env, request);
  return json({ ok: true }, 200, { "Set-Cookie": clear });
}

export const onRequest = () => methodNotAllowed();
