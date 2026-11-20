/**
 * GET /api/auth/discord
 * Inicia o login OAuth2 do Discord (escopo "identify": user_id, nome e avatar).
 * Gera um "state" aleatório guardado em cookie HttpOnly para impedir CSRF no callback.
 */
import { cookie, randomToken } from "../../_lib/session.js";
import { fail } from "../../_lib/http.js";

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return fail(503, "Discord OAuth2 não configurado: defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages.");
  }
  const origin = new URL(request.url).origin;
  const state = randomToken(16);

  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${origin}/api/auth/discord/callback`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.href,
      "Set-Cookie": cookie("it_oauth_state", state, { maxAge: 600 }),
      "Cache-Control": "no-store",
    },
  });
}
