/**
 * Cloudflare Pages Function — /api/auth/discord
 * Endpoint de autenticação OAuth2 do Discord (importa user_id, username e avatar).
 *
 * CSRF: gera um `state` aleatório, guarda em cookie curto HttpOnly e o envia
 * no authorize. O callback só troca o `code` se o `state` bater com o cookie.
 */

import { cookieEstado, criarValorEstado } from "../_lib/session.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID) {
    return Response.json({
      configured: false,
      message: "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages para login real, ou utilize o perfil de sessão local durante o diagnóstico.",
    });
  }

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  const estado = criarValorEstado();

  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", estado);

  const headers = new Headers();
  headers.set("Location", authorizeUrl.href);
  headers.append("Set-Cookie", cookieEstado(estado));

  return new Response(null, { status: 302, headers });
}
