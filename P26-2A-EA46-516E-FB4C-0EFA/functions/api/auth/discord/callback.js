import { cookie, criarSessao, lerCookie } from "../../../_lib/sessao.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const volta = (e) => Response.redirect(new URL("/?auth_error=" + e, url.origin).href, 302);

  if (!code || url.searchParams.get("error")) return volta("missing_code");
  if (!url.searchParams.get("state") || url.searchParams.get("state") !== lerCookie(request, "discord_state")) return volta("invalid_state");
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) return volta("missing_credentials");

  const redirectUri = env.DISCORD_REDIRECT_URI || new URL("/api/auth/discord/callback", url.origin).href;
  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code", code, redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) return volta("token_exchange_failed");
    const { access_token } = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${access_token}` } });
    if (!userRes.ok) return volta("fetch_user_failed");
    const d = await userRes.json();
    const userId = d.id;
    const username = d.global_name || d.username;
    const avatar = d.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${d.avatar}.png` : "https://cdn.discordapp.com/embed/avatars/0.png";

    await env.DB.prepare(
      "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
    ).bind(userId, username, avatar).run();

    const headers = new Headers({ Location: "/?login=success" });
    headers.append("Set-Cookie", cookie("discord_session", await criarSessao(env, { userId, username, avatar }), 86400));
    headers.append("Set-Cookie", cookie("discord_state", "", 0));
    return new Response(null, { status: 302, headers });
  } catch {
    return volta("exception");
  }
}
