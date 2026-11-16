// Integração com a API OAuth2 do Discord
const API = "https://discord.com/api";

export function safeReturnTo(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value.slice(0, 200);
}

export function authorizeUrl(env, origin, state) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/discord/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds");
  url.searchParams.set("state", state);
  return url.href;
}

export async function exchangeCode(env, origin, code) {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin}/api/auth/discord/callback`,
    }),
  });
  if (!res.ok) return null;
  return (await res.json()).access_token || null;
}

export async function fetchProfile(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const meRes = await fetch(`${API}/users/@me`, { headers });
  if (!meRes.ok) return null;
  const me = await meRes.json();
  const guildsRes = await fetch(`${API}/users/@me/guilds`, { headers });
  const guilds = guildsRes.ok ? await guildsRes.json() : [];
  const defaultAvatar = Number((BigInt(me.id) >> 22n) % 6n);
  return {
    id: String(me.id),
    username: me.global_name || me.username,
    globalName: me.global_name || null,
    avatar: me.avatar
      ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`,
    guilds: (Array.isArray(guilds) ? guilds : []).slice(0, 200).map((g) => ({
      id: String(g.id),
      name: String(g.name || "Servidor").slice(0, 100),
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : null,
    })),
  };
}

export async function saveProfile(env, profile) {
  const stmts = [
    env.DB.prepare(
      `INSERT INTO users (user_id, username, global_name, avatar_url) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET username = excluded.username, global_name = excluded.global_name,
         avatar_url = excluded.avatar_url, updated_at = datetime('now')`
    ).bind(profile.id, profile.username, profile.globalName, profile.avatar),
    env.DB.prepare("DELETE FROM user_guilds WHERE user_id = ?").bind(profile.id),
  ];
  const ins = env.DB.prepare("INSERT OR IGNORE INTO user_guilds (user_id, guild_id, guild_name, guild_icon) VALUES (?, ?, ?, ?)");
  for (const g of profile.guilds) stmts.push(ins.bind(profile.id, g.id, g.name, g.icon));
  await env.DB.batch(stmts);
}
