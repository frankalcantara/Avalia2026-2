// GET /api/auth/discord: inicia o OAuth2 do Discord (escopo identify).
// Gera state aleatório, grava no cookie oauth_state (10 min) e redireciona ao Discord.
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19
import { error, methodNotAllowed, redirect, safe } from "../../_lib/http.js";
import { cookie, randomHex, STATE_COOKIE } from "../../_lib/session.js";

export const onRequestGet = safe(async ({ request, env }) => {
  // Sem client_id não há como montar o login: erro claro em vez de quebrar.
  if (!env.DISCORD_CLIENT_ID) {
    return error(500, "oauth_not_configured", "Login com Discord não configurado (DISCORD_CLIENT_ID ausente).");
  }
  const state = randomHex(32);
  // redirect_uri derivado da própria origem da requisição (funciona em preview e produção).
  const redirectUri = new URL(request.url).origin + "/api/auth/discord/callback";
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return redirect(url.toString(), [cookie(STATE_COOKIE, state, 600)]);
});

// Qualquer outro método: 405.
export const onRequest = () => methodNotAllowed("GET");
