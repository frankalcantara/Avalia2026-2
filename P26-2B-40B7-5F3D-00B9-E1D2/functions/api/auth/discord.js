/**
 * Cloudflare Pages Function — /api/auth/discord
 * Inicia o login OAuth2 do Discord (importa user_id, username e avatar).
 * Gera um "state" aleatório para proteger contra login forjado (CSRF).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID) {
    return Response.json({
      configured: false,
      message: "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages.",
    });
  }

  // 1. Valor aleatório, impossível de adivinhar, único a cada tentativa de login
  const state = crypto.randomUUID();

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");

  // 2. O Discord devolve este mesmo valor na volta
  authorizeUrl.searchParams.set("state", state);

  // 3. Guardamos uma cópia no navegador, num cookie que o JavaScript da página não lê
  //    (HttpOnly), só vale por HTTPS (Secure) e expira em 10 minutos
  const cookie = `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;

  // 4. Redirecionamos com DOIS cabeçalhos. Response.redirect() não permite
  //    cookie, por isso montamos a resposta à mão.
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.href,
      "Set-Cookie": cookie,
    },
  });
}