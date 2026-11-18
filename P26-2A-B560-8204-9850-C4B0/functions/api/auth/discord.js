/**
 * Cloudflare Pages Function — `GET /api/auth/discord`
 *
 * Passo 1 do Authorization Code Flow:
 *  * gera `state` aleatório (32 bytes via `crypto.getRandomValues`);
 *  * grava `oauth_state` em cookie `HttpOnly; Secure; SameSite=Lax` (10 min);
 *  * redireciona (302) para o endpoint de autorização do Discord.
 *
 * Sem `DISCORD_CLIENT_ID` responde 503 `discord_not_configured` (JSON).
 *
 * @module functions/api/auth/discord
 */

import { canonicalOrigin, fail } from "../_lib/http.js";
import { OAUTH_STATE_COOKIE, createOAuthState, serializeCookie } from "../_lib/session.js";

/** Validade do cookie de `state` em segundos. */
const STATE_COOKIE_MAX_AGE = 600;

/**
 * `GET /api/auth/discord`
 *
 * @param {{ request: Request, env: Record<string, unknown> }} context Contexto do Pages Functions.
 * @returns {Response} Redirect 302 para o Discord ou JSON de erro.
 */
export function onRequestGet(context) {
  const { request, env } = context;

  const clientId = typeof env?.DISCORD_CLIENT_ID === "string" ? env.DISCORD_CLIENT_ID.trim() : "";
  if (!clientId) {
    return fail(
      503,
      "discord_not_configured",
      "O login com Discord não está configurado neste ambiente (DISCORD_CLIENT_ID ausente).",
    );
  }

  const requestUrl = new URL(request.url);
  const redirectUri = new URL("/api/auth/discord/callback", canonicalOrigin(env, requestUrl)).href;
  const state = createOAuthState();

  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "consent");

  const headers = new Headers();
  headers.set("Location", authorizeUrl.href);
  headers.append("Set-Cookie", serializeCookie(OAUTH_STATE_COOKIE, state, { maxAge: STATE_COOKIE_MAX_AGE }));

  return new Response(null, { status: 302, headers });
}

/**
 * Qualquer método diferente de GET → 405 em JSON.
 *
 * @returns {Response} 405 `method_not_allowed`.
 */
export function onRequest() {
  return fail(405, "method_not_allowed", "Método não permitido para este endpoint.");
}
