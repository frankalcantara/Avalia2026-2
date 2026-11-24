/**
 * Cloudflare Pages Function - /api/auth/discord
 * Inicia o OAuth2 do Discord com parametro state anti-CSRF.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID) {
    return Response.json(
      { ok: false, error: "discord_not_configured" },
      { status: 500 }
    );
  }

  // state: valor aleatorio, guardado em cookie e conferido no callback
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const state = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  const secure = url.protocol === "https:" ? "; Secure" : "";

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.href,
      "Set-Cookie": `oauth_state=${state}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,
    },
  });
}