import { createSessionCookie } from "../../../_lib/session.js";

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const found = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(name + "="));
  return found ? found.slice(name.length + 1) : null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const fail = (reason) => Response.redirect(new URL("/?auth_error=" + encodeURIComponent(reason), url.origin).href, 302);

  if (error || !code) return fail(error || "missing_code");

  const state = url.searchParams.get("state");
  const savedState = readCookie(request, "oauth_state");
  if (!state || !savedState || state !== savedState) return fail("invalid_state");

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) {
    return Response.json({
      ok: false,
      error: "missing_credentials",
      message: "Defina DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET e SESSION_SECRET nas variáveis do Cloudflare Pages.",
    }, { status: 500 });
  }

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) return fail("token_exchange_failed");

    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) return fail("fetch_user_failed");

    const discordUser = await userRes.json();
    const userId = discordUser.id;
    const username = discordUser.global_name || discordUser.username;
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    try {
      await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS discord_users (user_id TEXT PRIMARY KEY, username TEXT NOT NULL, avatar TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
      ).run();
      await env.DB.prepare(
        "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
      ).bind(userId, username, avatar).run();
    } catch {
      return fail("db_error");
    }

    const secure = url.protocol === "https:";
    const cookie = await createSessionCookie({ userId, username, avatar }, env.SESSION_SECRET, secure);
    const headers = new Headers({ Location: "/?login=success" });
    headers.append("Set-Cookie", cookie);
    headers.append("Set-Cookie", `oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`);
    return new Response(null, { status: 302, headers });
  } catch (err) {
    return fail("exception");
  }
}
