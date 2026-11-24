/**
 * Cloudflare Pages Function - /api/auth/discord/callback
 * Confere o state, troca o code por token, importa user_id/nome/avatar,
 * grava no D1 e cria uma sessao com token aleatorio (hash no banco).
 */
import { randomToken, sha256Hex, getCookie } from "../../../_lib/auth.js";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

function back(url, query, extraHeaders) {
  const headers = new Headers({ Location: new URL("/" + query, url.origin).href });
  for (const [k, v] of extraHeaders || []) headers.append(k, v);
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const clearState = ["Set-Cookie", `oauth_state=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0${secure}`];

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = getCookie(request, "oauth_state");

  if (url.searchParams.get("error") || !code) {
    return back(url, "?auth_error=cancelled", [clearState]);
  }
  if (!state || !cookieState || state !== cookieState) {
    return back(url, "?auth_error=invalid_state", [clearState]);
  }
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DB) {
    return back(url, "?auth_error=server_config", [clearState]);
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
    if (!tokenRes.ok) return back(url, "?auth_error=token_exchange", [clearState]);
    const tokenData = await tokenRes.json();

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) return back(url, "?auth_error=fetch_user", [clearState]);
    const du = await userRes.json();

    const userId = String(du.id);
    const username = du.global_name || du.username;
    const avatar = du.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${du.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    const token = randomToken(32);
    const tokenHash = await sha256Hex(token);
    const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
      ).bind(userId, username, avatar),
      env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Date.now()),
      env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(tokenHash, userId, expiresAt),
    ]);

    return back(url, "?login=success", [
      clearState,
      ["Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`],
    ]);
  } catch (err) {
    return back(url, "?auth_error=server_error", [clearState]);
  }
}