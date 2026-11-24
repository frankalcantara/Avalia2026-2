// Chamadas ao Discord isoladas aqui (testes substituem globalThis.fetch).
export async function exchangeCode(env, code, redirectUri) {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Discord token exchange failed: ${res.status}`);
  const data = await res.json();
  if (!data || !data.access_token) throw new Error('Discord token ausente');
  return data.access_token;
}

export async function fetchDiscordUser(accessToken) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord user fetch failed: ${res.status}`);
  const u = await res.json();
  if (!u || !u.id) throw new Error('Discord user inválido');
  return u;
}

export function avatarUrl(u) {
  const id = String(u.id);
  if (u.avatar) return `https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png?size=128`;
  let idx = 0;
  try {
    idx = Number((BigInt(id) >> 22n) % 6n);
  } catch {
    idx = 0;
  }
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}
