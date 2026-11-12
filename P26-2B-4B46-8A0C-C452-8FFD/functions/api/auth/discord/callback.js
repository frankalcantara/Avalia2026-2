import {
  createSession, discordCallback, discordConfigured, SESSION_COOKIE,
  SESSION_SECONDS, STATE_COOKIE,
} from "../../../lib/auth.js";
import { appOrigin, cookie, readCookie, redirect } from "../../../lib/http.js";

async function discordProfile(code, request, env) {
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: discordCallback(request, env),
    }),
  });
  if (!tokenResponse.ok) return null;
  const { access_token } = await tokenResponse.json();
  if (typeof access_token !== "string" || !access_token) return null;

  const profileResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!profileResponse.ok) return null;
  const profile = await profileResponse.json();
  if (typeof profile.id !== "string" || !/^\d{16,22}$/.test(profile.id)
    || typeof profile.username !== "string" || !profile.username) return null;

  const username = typeof profile.global_name === "string" && profile.global_name
    ? profile.global_name : profile.username;
  const avatar = typeof profile.avatar === "string" && /^(a_)?[a-f0-9]+$/.test(profile.avatar)
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${(BigInt(profile.id) >> 22n) % 6n}.png`;
  return { userId: profile.id, username, avatar };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clearState = cookie(STATE_COOKIE, "", 0);
  const failed = () => redirect("/?login=error", [clearState]);
  const state = readCookie(request, STATE_COOKIE);
  const code = url.searchParams.get("code");

  if (!discordConfigured(env) || url.origin !== appOrigin(request, env)
    || !state || state !== url.searchParams.get("state") || !code) return failed();

  try {
    const profile = await discordProfile(code, request, env);
    if (!profile) return failed();
    await env.DB.prepare(`
      INSERT INTO discord_users (user_id, username, avatar)
      VALUES (?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET username = excluded.username,
        avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP
    `).bind(profile.userId, profile.username, profile.avatar).run();

    const token = await createSession(env, profile.userId);
    return redirect("/", [clearState, cookie(SESSION_COOKIE, token, SESSION_SECONDS)]);
  } catch {
    return failed();
  }
}
