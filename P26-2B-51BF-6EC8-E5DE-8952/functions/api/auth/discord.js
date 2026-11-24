export async function onRequestGet({ env }) {
  const params = new URLSearchParams({
    client_id: env. DISCORD_CLIENT_ID,
    redirect_uri: env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify'
  });
  return Response.redirect(`https://discord.com/oauth2/authorize?${params}`, 302);
}