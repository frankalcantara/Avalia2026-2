/**
 * GET /api/auth/discord
 * Inicia o OAuth2 do Discord (escopo "identify": user_id, username e avatar).
 * Gera um "state" aleatório guardado em cookie HttpOnly para impedir CSRF no callback.
 */
import { cookie, erro } from "../../_lib/http.js";
import { tokenAleatorio } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return erro(500, "discord_nao_configurado", "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do projeto na Cloudflare.");
  }

  const origin = new URL(request.url).origin;
  const state = tokenAleatorio(16);

  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${origin}/api/auth/discord/callback`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);

  const headers = new Headers({ Location: authorize.href, "Cache-Control": "no-store" });
  headers.append("Set-Cookie", cookie("oauth_state", state, { maxAge: 600 }));
  return new Response(null, { status: 302, headers });
}
