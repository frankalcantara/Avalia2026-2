/**
 * Cloudflare Pages Function — GET /api/auth/discord
 * Inicia o login OAuth2 do Discord.
 *
 * Gera um "state" aleatório, guarda num cookie de curta duração e o envia
 * na URL de autorização. O callback confere se os dois são iguais, o que
 * impede que um atacante faça a vítima concluir um login iniciado por ele (CSRF).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID) {
    return Response.json({
      configured: false,
      message: "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages para o login funcionar.",
    }, { status: 500 });
  }

  // 16 bytes aleatórios -> 32 caracteres hexadecimais
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const state = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

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
      // 10 minutos é tempo de sobra para o usuário autorizar no Discord
      "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}