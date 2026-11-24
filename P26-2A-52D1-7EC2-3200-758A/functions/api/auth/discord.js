/**
 * GET /api/auth/discord
 * Inicia o login OAuth2 do Discord. Gera um "state" aleatório (proteção contra CSRF)
 * guardado num cookie temporário e redireciona para a tela de autorização do Discord.
 */
import { erro, montarCookie, tokenAleatorio } from "../../../lib/servidor.js";

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return erro("Login Discord não configurado: defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET no Cloudflare Pages.", 503);
  }

  const origem = new URL(request.url).origin;
  const state = tokenAleatorio(16);

  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${origem}/api/auth/discord/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: { Location: url.href, "Set-Cookie": montarCookie("oauth_state", state, 600) },
  });
}
