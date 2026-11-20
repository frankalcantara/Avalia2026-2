/**
 * Cloudflare Pages Function — GET /api/auth/discord/callback
 * Troca o code pelo token do Discord, importa user_id, nome e avatar, grava em `users`
 * (D1) e abre uma sessão: cookie HttpOnly com token aleatório; só o hash fica no banco.
 */
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  buildCookie,
  createSession,
  parseCookies,
} from "../../../_lib/util.js";

function back(origin, query, extraCookies = []) {
  const headers = new Headers({ Location: new URL(query, origin).href, "Cache-Control": "no-store" });
  for (const c of extraCookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const clearState = buildCookie("oauth_state", "", { maxAge: 0 });

  if (error || !code) {
    return back(url.origin, "/?auth_error=" + encodeURIComponent(error || "missing_code"), [clearState]);
  }

  // Valida o state (CSRF no fluxo de login).
  const savedState = parseCookies(request).oauth_state;
  if (!state || !savedState || state !== savedState) {
    return back(url.origin, "/?auth_error=invalid_state", [clearState]);
  }

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DB) {
    return back(url.origin, "/?auth_error=missing_configuration", [clearState]);
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
    if (!tokenRes.ok) return back(url.origin, "/?auth_error=token_exchange_failed", [clearState]);

    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) return back(url.origin, "/?auth_error=fetch_user_failed", [clearState]);

    const du = await userRes.json();
    const userId = String(du.id);
    const username = String(du.global_name || du.username || "usuário").slice(0, 80);
    const avatar = du.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${du.avatar}.png?size=128`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO users (id, username, avatar, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET username = excluded.username,
                                     avatar = excluded.avatar,
                                     updated_at = excluded.updated_at`
    ).bind(userId, username, avatar, now, now).run();

    const token = await createSession(env, userId);
    return back(url.origin, "/?login=success", [
      buildCookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS }),
      clearState,
    ]);
  } catch {
    return back(url.origin, "/?auth_error=exception", [clearState]);
  }
}
