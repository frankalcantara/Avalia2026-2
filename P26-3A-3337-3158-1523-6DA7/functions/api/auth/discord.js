import { json, buildCookie, STATE_COOKIE } from "../../_utils.js";

/**
 * /api/auth/discord — inicia o OAuth2 do Discord (authorization code).
 * Gera um `state` aleatorio guardado em cookie HttpOnly para proteger contra CSRF de login.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return json(
      {
        configured: false,
        message:
          "Login indisponível: defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages.",
      },
      503
    );
  }

  const stateBytes = crypto.getRandomValues(new Uint8Array(16));
  const state = Array.from(stateBytes, (b) => b.toString(16).padStart(2, "0")).join("");

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  const headers = new Headers({
    Location: authorizeUrl.href,
    "Cache-Control": "no-store",
  });
  headers.append(
    "Set-Cookie",
    buildCookie(STATE_COOKIE, state, { maxAge: 600, path: "/api/auth/discord" })
  );
  return new Response(null, { status: 302, headers });
}
