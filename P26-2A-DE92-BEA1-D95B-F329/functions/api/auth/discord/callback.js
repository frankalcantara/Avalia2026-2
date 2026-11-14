import { cookie, digest, methodAllowed, OAUTH_COOKIE, parseCookies, randomToken, redirect, requireOAuth, SESSION_COOKIE, SESSION_TTL, signValue, verifySignedValue, withErrors } from "../../../_lib.js";
export const onRequest = withErrors(async ({ request, env }) => {
  methodAllowed(request, ["GET"]);
  requireOAuth(env);
  const url = new URL(request.url);
  const clearState = cookie(OAUTH_COOKIE, "", 0);
  const fail = (code) => redirect(`${url.origin}/?auth_error=${code}`, [clearState]);
  const saved = await verifySignedValue(parseCookies(request)[OAUTH_COOKIE], env.SESSION_SECRET);
  const [expectedState, issuedAt] = (saved || "").split(".");
  const state = url.searchParams.get("state");
  if (!saved || !/^[A-Za-z0-9_-]{43}$/.test(expectedState || "") || state !== expectedState || !/^\d{13}$/.test(issuedAt || "") || Date.now() - Number(issuedAt) > 600000 || Number(issuedAt) > Date.now() + 30000) return fail("invalid_state");
  if (url.searchParams.has("error")) return fail("access_denied");
  const code = url.searchParams.get("code");
  if (!code || code.length > 2048) return fail("invalid_code");
  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code", code, redirect_uri: `${url.origin}/api/auth/discord/callback` }),
      signal: AbortSignal.timeout(15000),
    });
    if (!tokenResponse.ok) return fail("token_exchange_failed");
    const token = await tokenResponse.json();
    if (typeof token.access_token !== "string" || token.token_type?.toLowerCase() !== "bearer") return fail("invalid_token");
    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15000),
    });
    if (!userResponse.ok) return fail("profile_failed");
    const user = await userResponse.json();
    if (!/^\d{5,25}$/.test(user.id || "") || typeof user.username !== "string" || !user.username.trim()) return fail("profile_failed");
    const username = user.username.slice(0, 128);
    const avatar = typeof user.avatar === "string" && /^[A-Za-z0-9_]{1,128}$/.test(user.avatar) ? user.avatar : null;
    const sessionToken = randomToken();
    const tokenHash = await digest(sessionToken);
    const csrf = randomToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL * 1000).toISOString();
    const statements = [
      env.DB.prepare(`INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET username=excluded.username, avatar=excluded.avatar, updated_at=excluded.updated_at`).bind(user.id, username, avatar, now.toISOString()),
      env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now.toISOString()),
      env.DB.prepare("INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").bind(tokenHash, user.id, csrf, expiresAt, now.toISOString()),
    ];
    const previous = await verifySignedValue(parseCookies(request)[SESSION_COOKIE], env.SESSION_SECRET);
    if (previous && /^[A-Za-z0-9_-]{43}$/.test(previous)) statements.push(env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await digest(previous)));
    await env.DB.batch(statements);
    const signedSession = await signValue(sessionToken, env.SESSION_SECRET);
    return redirect(`${url.origin}/`, [clearState, cookie(SESSION_COOKIE, signedSession, SESSION_TTL)]);
  } catch { return fail("login_failed"); }
});
