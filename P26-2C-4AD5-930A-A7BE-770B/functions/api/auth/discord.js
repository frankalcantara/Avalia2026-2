function randomHex(bytesLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID) {
    const target = new URL("/", url.origin);
    target.searchParams.set("auth_error", "missing_credentials");
    return Response.redirect(target.href, 302);
  }

  const state = randomHex(32);
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
      "Set-Cookie": `discord_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}
