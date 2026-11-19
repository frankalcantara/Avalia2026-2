import {
  createSessionCookie, clearCookie, getCookie, STATE_COOKIE,
} from "../../../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const fail = (code) => Response.redirect(new URL("/?auth_error=" + code, url.origin).href, 302);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = getCookie(request, STATE_COOKIE);

  if (url.searchParams.get("error") || !code) return fail("missing_code");
  if (!state || !savedState || state !== savedState) return fail("invalid_state");
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) return fail("missing_credentials");

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
    if (!tokenRes.ok) return fail("token_exchange_failed");
    const token = await tokenRes.json();

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userRes.ok) return fail("fetch_user_failed");
    const du = await userRes.json();

    const user = {
      userId: du.id,
      username: du.global_name || du.username,
      avatar: du.avatar
        ? `https://cdn.discordapp.com/avatars/${du.id}/${du.avatar}.png`
        : "https://cdn.discordapp.com/embed/avatars/0.png",
    };

    await env.DB.prepare(
      `INSERT INTO discord_users (user_id, username, avatar, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         username = excluded.username,
         avatar = excluded.avatar,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(user.userId, user.username, user.avatar).run();

    const headers = new Headers({ Location: "/?login=success" });
    headers.append("Set-Cookie", await createSessionCookie(request, env, user));
    headers.append("Set-Cookie", clearCookie(request, STATE_COOKIE));
    return new Response(null, { status: 302, headers });
  } catch (err) {
    console.error("CALLBACK ERROR:", err && err.message ? err.message : err);
    return fail("exception");
  }
}