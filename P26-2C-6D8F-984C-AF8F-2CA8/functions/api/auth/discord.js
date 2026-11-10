/**
 * GET /api/auth/discord — inicia o OAuth2 do Discord (escopo identify) com `state` anti-CSRF.
 */
import { tokenAleatorio, cookie } from "../../_util.js";

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return Response.redirect(`${origin}/?auth_error=discord_nao_configurado`, 302);
  }

  const state = tokenAleatorio(16);
  const auth = new URL("https://discord.com/oauth2/authorize");
  auth.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  auth.searchParams.set("redirect_uri", `${origin}/api/auth/discord/callback`);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "identify");
  auth.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: { Location: auth.href, "Set-Cookie": cookie("oauth_state", state, 600) },
  });
}
