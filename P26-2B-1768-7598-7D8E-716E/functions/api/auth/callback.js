export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code"), state = url.searchParams.get("state");
  const ck = (request.headers.get("Cookie") || "").match(/(?:^|; )oauth_state=([\w-]+)/);
  if (!code || !state || !ck || ck[1] !== state) return new Response("Estado OAuth inválido. Tente entrar de novo.", { status: 400 });

  const tr = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: url.origin + "/api/auth/callback",
    }),
  });
  if (!tr.ok) return new Response("Falha ao obter o token do Discord.", { status: 502 });
  const { access_token } = await tr.json();
  const ur = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + access_token } });
  if (!ur.ok) return new Response("Falha ao ler o usuário do Discord.", { status: 502 });
  const d = await ur.json();

  const sid = crypto.randomUUID();
  const week = 7 * 24 * 3600;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (discord_id, username, avatar) VALUES (?, ?, ?) ON CONFLICT(discord_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar")
      .bind(d.id, d.global_name || d.username, d.avatar || null),
    env.DB.prepare("INSERT INTO sessions (id, discord_id, expires_at) VALUES (?, ?, ?)").bind(sid, d.id, Date.now() + week * 1000),
  ]);
  const h = new Headers({ Location: "/" });
  h.append("Set-Cookie", `sid=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${week}`);
  h.append("Set-Cookie", "oauth_state=; Path=/; Max-Age=0");
  return new Response(null, { status: 302, headers: h });
}
