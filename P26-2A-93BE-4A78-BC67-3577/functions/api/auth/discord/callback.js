/**
 * Cloudflare Pages Function — /api/auth/discord/callback
 * 1) confere o state; 2) troca o code pelo token; 3) busca o perfil (@me);
 * 4) grava/atualiza o usuário no D1; 5) cria uma sessão no D1 e entrega só o token em cookie HttpOnly.
 */
import { createSession, getCookie, sessionCookie } from "../../../_lib/session.js";

const CLEAR_STATE_COOKIE = "oauth_state=; Path=/api/auth/discord; HttpOnly; SameSite=Lax; Max-Age=0; Secure";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const fail = (reason) => Response.redirect(new URL("/?auth_error=" + encodeURIComponent(reason), url.origin).href, 302);

  if (error || !code) return fail(error || "missing_code");

  // Anti-CSRF: o state devolvido pelo Discord precisa ser o mesmo que guardamos no cookie.
  const state = url.searchParams.get("state");
  const savedState = getCookie(request, "oauth_state");
  if (!state || !savedState || state !== savedState) return fail("invalid_state");

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return Response.json({
      ok: false,
      error: "missing_credentials",
      message: "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages (ou no .dev.vars local).",
    }, { status: 500 });
  }
  if (!env.DB) return fail("db_unavailable");

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

    await env.DB.prepare(
      "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) " +
      "ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
    ).bind(userId, username, avatar).run();

    const sessionId = await createSession(env, userId);

    const headers = new Headers({ Location: "/?login=success" });
    headers.append("Set-Cookie", sessionCookie(sessionId));
    headers.append("Set-Cookie", CLEAR_STATE_COOKIE);
    return new Response(null, { status: 302, headers });
  } catch (err) {
    console.error("Falha no callback do Discord:", err);
    return fail("exception");
  }
}
