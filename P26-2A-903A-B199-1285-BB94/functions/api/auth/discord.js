export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const redirectUri = env.DISCORD_REDIRECT_URI || `${url.origin}/api/auth/discord/callback`;

  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify"
  });

  return Response.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`, 302);
}