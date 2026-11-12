/**
 * GET /api/auth/discord/callback
 * Confere o "state", troca o code pelo access_token, busca /users/@me e
 * importa user_id, nome e avatar para o Cloudflare D1. Cria a sessão no servidor.
 */
import { parseCookies } from "../../../_lib/rules.js";
import { cookie, createSession } from "../../../_lib/session.js";

function back(origin, reason, extraHeaders = []) {
  const headers = new Headers({ Location: `${origin}/?auth_error=${encodeURIComponent(reason)}`, "Cache-Control": "no-store" });
  headers.append("Set-Cookie", cookie("it_oauth_state", "", { maxAge: 0 }));
  for (const h of extraHeaders) headers.append("Set-Cookie", h);
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = parseCookies(request.headers.get("Cookie")).it_oauth_state;

  if (url.searchParams.get("error")) return back(origin, url.searchParams.get("error"));
  if (!code) return back(origin, "missing_code");
  if (!state || !expectedState || state !== expectedState) return back(origin, "invalid_state");
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return back(origin, "oauth_not_configured");
  if (!env.DB) return back(origin, "d1_not_bound");

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin}/api/auth/discord/callback`,
      }),
    });
    if (!tokenRes.ok) return back(origin, "token_exchange_failed");
    const { access_token: accessToken } = await tokenRes.json();

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) return back(origin, "fetch_user_failed");
    const d = await userRes.json();

    const userId = String(d.id);
    const username = String(d.global_name || d.username || "Usuário").slice(0, 80);
    let avatar;
    if (d.avatar) {
      const ext = String(d.avatar).startsWith("a_") ? "gif" : "png";
      avatar = `https://cdn.discordapp.com/avatars/${userId}/${d.avatar}.${ext}?size=128`;
    } else {
      // avatar padrão do Discord para quem não tem foto
      const index = Number((BigInt(userId) >> 22n) % 6n);
      avatar = `https://cdn.discordapp.com/embed/avatars/${index}.png`;
    }

    await env.DB.prepare(
      `INSERT INTO users (user_id, username, avatar) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    ).bind(userId, username, avatar).run();

    const sessionCookie = await createSession(env, userId);
    const headers = new Headers({ Location: `${origin}/#/`, "Cache-Control": "no-store" });
    headers.append("Set-Cookie", sessionCookie);
    headers.append("Set-Cookie", cookie("it_oauth_state", "", { maxAge: 0 }));
    return new Response(null, { status: 302, headers });
  } catch {
    return back(origin, "exception");
  }
}
