export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const q = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: url.origin + "/api/auth/callback",
    response_type: "code",
    scope: "identify",
    state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: "https://discord.com/oauth2/authorize?" + q,
      "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}