/** GET /api/me — usuário logado (ou null) e se o login Discord está configurado. */
import { json, CHAVE } from "../_lib/http.js";
import { usuarioPublico } from "../_lib/auth.js";

export async function onRequestGet({ env, data }) {
  return json({
    ok: true,
    chave: CHAVE,
    user: usuarioPublico(data.user),
    discordConfigurado: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
  });
}
