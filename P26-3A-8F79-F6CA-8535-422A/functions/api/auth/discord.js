import { cookie, error } from "../../_lib.js";

// GET /api/auth/discord → 302 para o Discord com state anti-CSRF guardado em cookie curto.
export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) {
    return error(500, "Login com Discord não configurado no servidor.");
  }
  const state = crypto.randomUUID();
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("redirect_uri", new URL("/api/auth/discord/callback", request.url).href);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: { Location: url.href, "Set-Cookie": cookie("oauth_state", state, 600, "/api/auth") },
  });
}

export { methodNotAllowed as onRequest } from "../../_lib.js";
