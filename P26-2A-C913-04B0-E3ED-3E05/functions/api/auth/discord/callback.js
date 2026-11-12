import { signValue, verifyValue, sessionCookie } from "../../_shared/auth.js";

function redirect(origin, query) {
  return Response.redirect(new URL(`/?${query}`, origin).href, 302);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = request.headers.get("Cookie") || "";
  const stateCookie = cookies.match(/(?:^|;\s*)discord_oauth_state=([^;]+)/)?.[1];
  const statePayload = await verifyValue(stateCookie, env);
  let stateData = null;
  try { stateData = JSON.parse(statePayload || "null"); } catch {}
  if (url.searchParams.has("error") || !code || !stateData || stateData.state !== state || stateData.expiresAt < Date.now()) {
    return new Response(null, { status: 302, headers: { Location: "/?auth_error=state_validation_failed", "Set-Cookie": "discord_oauth_state=; Path=/api/auth/discord/callback; HttpOnly; SameSite=Lax; Max-Age=0; Secure" } });
  }
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DB) return redirect(url.origin, "auth_error=oauth_not_configured");
  const callbackUrl = new URL("/api/auth/discord/callback", url.origin).href;
  let redirectUri = callbackUrl;
  if (env.DISCORD_REDIRECT_URI) {
    try {
      const configured = new URL(env.DISCORD_REDIRECT_URI);
      if (configured.href === callbackUrl) redirectUri = configured.href;
    } catch {}
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    });
    if (!tokenRes.ok) return redirect(url.origin, "auth_error=token_exchange_failed");
    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    if (!userRes.ok) return redirect(url.origin, "auth_error=profile_fetch_failed");
    const discordUser = await userRes.json();
    const userId = String(discordUser.id || "");
    const username = String(discordUser.global_name || discordUser.username || "").slice(0, 80);
    if (!/^\d{5,25}$/.test(userId) || !username) return redirect(url.origin, "auth_error=invalid_profile");
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) >> 22n) % 6}.png`;
    await env.DB.prepare("INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP").bind(userId, username, avatar).run();
    const signedSession = await signValue(JSON.stringify({ userId, username, avatar, expiresAt: Date.now() + 86400000 }), env);
    const headers = new Headers({
      Location: "/?login=success",
      "Cache-Control": "no-store",
    });
    headers.append("Set-Cookie", sessionCookie(signedSession));
    headers.append("Set-Cookie", "discord_oauth_state=; Path=/api/auth/discord/callback; HttpOnly; SameSite=Lax; Max-Age=0; Secure");
    return new Response(null, { status: 302, headers });
  } catch {
    return redirect(url.origin, "auth_error=login_failed");
  }
}
