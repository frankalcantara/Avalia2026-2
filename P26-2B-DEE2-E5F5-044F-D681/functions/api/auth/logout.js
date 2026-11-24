/** POST /api/auth/logout — apaga a sessão no D1 e o cookie. */
import { json } from "../../_lib/http.js";
import { encerrarSessao } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const setCookie = await encerrarSessao(request, env);
  return json({ ok: true }, 200, { "Set-Cookie": setCookie });
}
