/**
 * Cloudflare Pages Function — GET /api/auth/me
 * Retorna o usuário autenticado pela sessão armazenada no Cloudflare D1.
 */
import { getSessionUser } from "../../../src/server/auth.js";
import { jsonResponse } from "../../../src/server/http.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);

  return jsonResponse({
    ok: true,
    authenticated: Boolean(user),
    discordOAuthConfigured: Boolean(env?.DISCORD_CLIENT_ID && env?.DISCORD_CLIENT_SECRET),
    user,
  });
}
