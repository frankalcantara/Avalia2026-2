import { assinar } from "../../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const erro = (e) => Response.redirect(new URL("/?auth_error=" + e, url.origin).href, 302);
  if (url.searchParams.get("error") || !code) return erro("missing_code");
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return erro("missing_credentials");
  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: new URL("/api/auth/discord/callback", url.origin).href,
      }),
    });
    if (!tokenRes.ok) return erro("token_exchange_failed");
    const { access_token } = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + access_token } });
    if (!userRes.ok) return erro("fetch_user_failed");
    const d = await userRes.json();
    const userId = d.id;
    const username = d.global_name || d.username;
    const avatar = d.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${d.avatar}.png` : "https://cdn.discordapp.com/embed/avatars/0.png";
    try {
      await env.DB.prepare("INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP").bind(userId, username, avatar).run();
    } catch {}
    const valor = await assinar(env, { userId, username, avatar });
    return new Response(null, {
      status: 302,
      headers: { Location: "/?login=success", "Set-Cookie": `discord_session=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400; Secure` },
    });
  } catch { return erro("exception"); }
}
