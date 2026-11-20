import { json } from "../../_lib/http.js";
import { cookieSessaoVazio, encerrarSessao } from "../../_lib/sessao.js";

export async function onRequestPost({ request, env }) {
  if (env.DB) await encerrarSessao(env.DB, request);
  return json({ ok: true }, 200, { "set-cookie": cookieSessaoVazio() });
}
