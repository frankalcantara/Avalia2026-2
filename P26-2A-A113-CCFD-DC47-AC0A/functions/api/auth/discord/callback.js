/**
 * GET /api/auth/discord/callback — valida o state, troca o code por token, lê /users/@me,
 * grava o usuário no D1 e cria um cookie de sessão ASSINADO (HMAC).
 */
import { buildCookie, getCookie, signSession, SESSION_COOKIE, SESSION_TTL, STATE_COOKIE } from "../../../_lib/util.js";

function redirect(url, path, cookies = []) {
  const headers = new Headers({ Location: new URL(path, url.origin).href });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const clearState = buildCookie(STATE_COOKIE, "", request, 0);

  if (error || !code) return redirect(url, "/?auth_error=" + encodeURIComponent(error || "missing_code"), [clearState]);

  const state = url.searchParams.get("state");
  const savedState = getCookie(request, STATE_COOKIE);
  if (!state || !savedState || state !== savedState) return redirect(url, "/?auth_error=invalid_state", [clearState]);

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) {
    return redirect(url, "/?auth_error=missing_credentials", [clearState]);
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
    if (!tokenRes.ok) return redirect(url, "/?auth_error=token_exchange_failed", [clearState]);

    const { access_token } = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${access_token}` } });
    if (!userRes.ok) return redirect(url, "/?auth_error=fetch_user_failed", [clearState]);

    const u = await userRes.json();
    const userId = String(u.id);
    const username = u.global_name || u.username;
    const avatar = u.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${u.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    await env.DB.prepare(
      "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) " +
      "ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
    ).bind(userId, username, avatar).run();

    const session = await signSession(
      { userId, username, avatar, exp: Math.floor(Date.now() / 1000) + SESSION_TTL },
      env.SESSION_SECRET
    );
    return redirect(url, "/?login=success", [buildCookie(SESSION_COOKIE, session, request, SESSION_TTL), clearState]);
  } catch {
    return redirect(url, "/?auth_error=exception", [clearState]);
  }
}
