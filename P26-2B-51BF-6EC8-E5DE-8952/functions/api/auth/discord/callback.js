export async function onRequestGet({ request, env }) {
  const code = new URL(request.url).searchParams.get('code');
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env. DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: env.DISCORD_REDIRECT_URI,
      code
    })
  });
  const token = await tokenRes.json();
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  const u = await userRes.json();
  const avatar = u.avatar
    ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;
  await env.DB.prepare('INSERT OR REPLACE INTO users (id, username, avatar) VALUES (?,?,?)')
    .bind(u.id, u.username, avatar).run();
  const headers = new Headers({ Location: '/' });
  headers.append('Set-Cookie', `discord_id=${u.id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  return new Response(null, { status: 302, headers });
}