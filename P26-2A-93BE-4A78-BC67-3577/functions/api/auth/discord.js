/**
 * Cloudflare Pages Function — /api/auth/discord
 * Inicia o OAuth2 do Discord (escopo identify). Gera um "state" aleatório e o guarda
 * num cookie curto; o callback confere se o state devolvido pelo Discord é o mesmo (anti-CSRF).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID) {
    return Response.json({
      configured: false,
      message: "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages (ou no .dev.vars local) para ativar o login.",
    }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.href,
      "Set-Cookie": `oauth_state=${state}; Path=/api/auth/discord; HttpOnly; SameSite=Lax; Max-Age=600; Secure`,
    },
  });
}
