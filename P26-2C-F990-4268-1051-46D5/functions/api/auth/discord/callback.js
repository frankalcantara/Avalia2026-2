/**
 * Cloudflare Pages Function: /api/auth/discord/callback
 * Validates "state", exchanges the code for a token, reads the Discord profile
 * (user_id, username, avatar), saves it in D1 and opens a server-side session.
 */
import { SESSION_TTL, cookie, getCookie, json, randomHex, sha256Hex } from "../../../_lib/auth.js";

function back(origin, query, extraHeaders = []) {
  const headers = new Headers({ Location: new URL(query, origin).href });
  for (const value of extraHeaders) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const clearState = cookie("oauth_state", "", 0);

  if (error || !code) {
    return back(url.origin, "/?auth_error=" + encodeURIComponent(error || "missing_code"), [clearState]);
  }
  if (!state || state !== getCookie(request, "oauth_state")) {
    return back(url.origin, "/?auth_error=invalid_state", [clearState]);
  }
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return json({ ok: false, error: "missing_credentials" }, 500);
  }
  if (!env.DB) {
    return back(url.origin, "/?auth_error=missing_database", [clearState]);
  }

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
    if (!tokenRes.ok) return back(url.origin, "/?auth_error=token_exchange_failed", [clearState]);
    const tokenData = await tokenRes.json();

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) return back(url.origin, "/?auth_error=fetch_user_failed", [clearState]);
    const discordUser = await userRes.json();

    const userId = String(discordUser.id);
    const username = String(discordUser.global_name || discordUser.username || "Estudante").slice(0, 80);
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    const now = Math.floor(Date.now() / 1000);
    const token = randomHex(32);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO discord_users (user_id, username, avatar, updated_at)
         VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET username = excluded.username,
           avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP`
      ).bind(userId, username, avatar),
      env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?1").bind(now),
      env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)").bind(
        await sha256Hex(token),
        userId,
        now + SESSION_TTL
      ),
    ]);

    return back(url.origin, "/?login=success", [cookie("session", token, SESSION_TTL), clearState]);
  } catch (err) {
    return back(url.origin, "/?auth_error=exception", [clearState]);
  }
}
