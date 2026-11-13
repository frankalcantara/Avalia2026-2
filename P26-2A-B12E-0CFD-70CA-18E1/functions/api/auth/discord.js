/**
 * GET /api/auth/discord
 * Inicia o fluxo OAuth2: grava um `state` em cookie HttpOnly e redireciona
 * para o Discord. O `next` opcional volta o usuário para a sala de origem.
 */

import { randomHex } from "../../_lib/crypto.js";
import { urlAutorizacao } from "../../_lib/discord.js";
import { criarCookie, destinoSeguro, redirecionar } from "../../_lib/http.js";

const COOKIE_STATE = "sorteio_oauth_state";
const VALIDADE_STATE_S = 600;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const destino = destinoSeguro(url.searchParams.get("next"), "/");

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return redirecionar("/?auth_error=nao_configurado");
  }

  const state = randomHex(16);
  const seguro = url.protocol === "https:";
  const cookie = criarCookie(
    COOKIE_STATE,
    JSON.stringify({ state, next: destino }),
    {
      httpOnly: true,
      secure: seguro,
      sameSite: "Lax",
      path: "/api/auth/discord",
      maxAge: VALIDADE_STATE_S,
    }
  );

  return redirecionar(urlAutorizacao(request, env.DISCORD_CLIENT_ID, state), { cookies: [cookie] });
}
