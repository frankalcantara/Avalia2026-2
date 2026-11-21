/**
 * POST /api/auth/logout
 * Apaga a sessão do D1 e limpa o cookie.
 */
import { encerrarSessao, json } from "../../../lib/servidor.js";

export async function onRequestPost({ request, env }) {
  const cookie = await encerrarSessao(env, request);
  return json({ ok: true }, 200, { "Set-Cookie": cookie });
}
