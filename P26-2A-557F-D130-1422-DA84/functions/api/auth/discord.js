/**
 * /api/auth/discord — inicia o login OAuth2 do Discord (escopo identify: user_id, nome e avatar).
 * Guarda um "state" aleatório em cookie para o callback conferir (anti-CSRF do fluxo OAuth).
 */
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.DISCORD_CLIENT_ID) {
    return Response.json(
      { ok: false, erro: "DISCORD_CLIENT_ID não configurado nas variáveis do Cloudflare Pages." },
      { status: 500 }
    );
  }
  const state = crypto.randomUUID();
  const destino = new URL("https://discord.com/oauth2/authorize");
  destino.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${url.origin}/api/auth/discord/callback`,
    scope: "identify",
    state,
  }).toString();
  return new Response(null, {
    status: 302,
    headers: {
      Location: destino.toString(),
      "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=600`,
    },
  });
}
