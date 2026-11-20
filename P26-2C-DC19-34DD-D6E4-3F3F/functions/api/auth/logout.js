import { json, erro, erroInterno, mesmaOrigem } from "../../_lib/http.js";
import { encerrarSessao } from "../../_lib/session.js";

export async function onRequestPost({ request, env }) {
  try {
    // Logout funciona sem sessão; só recusa Origin presente e de outro host.
    if (!mesmaOrigem(request, true)) return erro(403, "Origem não permitida.");
    const cookie = await encerrarSessao(env, request);
    return json({ ok: true }, 200, { "Set-Cookie": cookie });
  } catch (e) {
    return erroInterno(e);
  }
}
