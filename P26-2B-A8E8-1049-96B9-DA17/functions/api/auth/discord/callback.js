import { isHttps } from "../../../_lib/http.js";
import {
  SESSION_COOKIE, SESSION_TTL, STATE_COOKIE, buildCookie, getCookie, redirectUriFor, signSession, timingSafeEqualStr,
} from "../../../_lib/session.js";

/**
 * GET /api/auth/discord/callback — valida state, troca o code em discord.com/api/oauth2/token,
 * lê users/@me, faz upsert em discord_users (env.DB) e emite cookie de sessão assinado.
 */
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const secure = isHttps(request);
  const clearState = buildCookie(STATE_COOKIE, "", { maxAge: 0, secure, path: "/api/auth" });
  const back = (code) => {
    const h = new Headers({ Location: "/?auth_error=" + encodeURIComponent(code), "Cache-Control": "no-store" });
    h.append("Set-Cookie", clearState);
    return new Response(null, { status: 302, headers: h });
  };

  const error = url.searchParams.get("error");
  if (error === "access_denied") return back("access_denied");

  // state estrito: precisa existir no cookie e na query, e ser idêntico.
  const stateCookie = getCookie(request, STATE_COOKIE);
  const stateParam = url.searchParams.get("state");
  if (!stateCookie || !stateParam || !timingSafeEqualStr(stateCookie, stateParam)) return back("invalid_state");
  if (error) return back("oauth_error");

  const code = url.searchParams.get("code");
  if (!code || code.length > 512) return back("missing_code");
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) return back("server_misconfigured");

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUriFor(request),
      }),
    });
    if (!tokenRes.ok) return back("token_exchange_failed");
    const tokenData = await tokenRes.json();
    if (typeof tokenData.access_token !== "string") return back("token_exchange_failed");

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) return back("fetch_user_failed");
    const du = await userRes.json();
    if (!du || typeof du.id !== "string") return back("fetch_user_failed");

    const userId = du.id;
    const username = String(du.global_name || du.username || "Usuário").slice(0, 80);
    const avatar = typeof du.avatar === "string" ? du.avatar : null; // hash do Discord

    await env.DB.prepare(
      "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
    ).bind(userId, username, avatar).run();

    const token = await signSession({ userId, username, avatar }, env.SESSION_SECRET);
    const headers = new Headers({ Location: "/?login=success", "Cache-Control": "no-store" });
    headers.append("Set-Cookie", buildCookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL, secure }));
    headers.append("Set-Cookie", clearState);
    return new Response(null, { status: 302, headers });
  } catch {
    return back("exception");
  }
}
