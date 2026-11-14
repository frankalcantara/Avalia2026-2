export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Código de autorização ausente.", { status: 400 });
  }

  const redirectUri = env.DISCORD_REDIRECT_URI || `${url.origin}/api/auth/discord/callback`;

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    })
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    return new Response("Erro ao obter token do Discord.", { status: 401 });
  }

  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const discordUser = await userResponse.json();

  const avatarUrl = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
    : null;

  await env.DB.prepare(`
    INSERT INTO usuarios (discord_id, nome, avatar)
    VALUES (?1, ?2, ?3)
    ON CONFLICT(discord_id) DO UPDATE SET nome = excluded.nome, avatar = excluded.avatar
  `)
    .bind(discordUser.id, discordUser.global_name || discordUser.username, avatarUrl)
    .run();

  const dbUser = await env.DB.prepare("SELECT id, discord_id, nome, avatar FROM usuarios WHERE discord_id = ?1")
    .bind(discordUser.id)
    .first();

  const sessionData = btoa(encodeURIComponent(JSON.stringify(dbUser)));
  const headers = new Headers({
    Location: "/",
    "Set-Cookie": `session=${sessionData}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
  });

  return new Response(null, { status: 302, headers });
}