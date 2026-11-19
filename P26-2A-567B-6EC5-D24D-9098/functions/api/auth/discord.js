/**
 * Cloudflare Pages Function — /api/auth/discord
 * Inicia o OAuth2 do Discord: gera um `state` aleatório, guarda em cookie curto
 * e redireciona para a autorização (escopo `identify`).
 */
import { STATE_COOKIE, STATE_COOKIE_PATH, STATE_TTL_SECONDS, buildCookie, randomHex } from "../../_lib/auth.js";
import { methodNotAllowed, redirect } from "../../_lib/http.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") return methodNotAllowed("GET");

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return redirect("/?auth_error=not_configured");
  }

  const url = new URL(request.url);
  const state = randomHex(32);
  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;

  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  return redirect(authorizeUrl.href, [
    buildCookie(STATE_COOKIE, state, { maxAge: STATE_TTL_SECONDS, path: STATE_COOKIE_PATH }),
  ]);
}