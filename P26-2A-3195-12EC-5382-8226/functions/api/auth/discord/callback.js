/**
 * GET /api/auth/discord/callback — retorno do Discord.
 * 1. confere o "state" contra o cookie;
 * 2. troca o "code" por um access token (com o Client Secret, só no servidor);
 * 3. busca /users/@me e importa user_id, nome de usuário e avatar para o D1;
 * 4. cria a sessão e devolve o usuário para o painel.
 */
import { redirect, cookie, parseCookies } from "../../../../src/lib/http.js";
import { createSession, isSecureRequest } from "../../../../src/lib/session.js";
import {
  DISCORD_TOKEN_URL,
  DISCORD_ME_URL,
  OAUTH_STATE_COOKIE,
  redirectUri,
  profileFromDiscord,
} from "../../../../src/lib/discord.js";

function fail(reason, request) {
  // apaga o cookie de state em qualquer saída
  return redirect(`/?auth_error=${encodeURIComponent(reason)}`, {
    "Set-Cookie": cookie(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/api/auth", secure: isSecureRequest(request) }),
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (url.searchParams.get("error")) return fail("access_denied", request);
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return fail("not_configured", request);

  const expectedState = parseCookies(request.headers.get("Cookie"))[OAUTH_STATE_COOKIE];
  if (!code || !state || !expectedState || state !== expectedState) return fail("invalid_state", request);

  let tokenRes;
  try {
    tokenRes = await fetch(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(request),
      }),
    });
  } catch {
    return fail("token_exchange_failed", request); // Discord fora do ar / falha de rede
  }
  if (!tokenRes.ok) return fail("token_exchange_failed", request);
  const token = await tokenRes.json().catch(() => null);
  if (!token || typeof token.access_token !== "string") return fail("token_exchange_failed", request);

  let meRes;
  try {
    meRes = await fetch(DISCORD_ME_URL, {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
    });
  } catch {
    return fail("profile_failed", request);
  }
  if (!meRes.ok) return fail("profile_failed", request);
  const profile = profileFromDiscord(await meRes.json().catch(() => null));
  if (!profile) return fail("profile_failed", request);

  await env.DB.prepare(
    `INSERT INTO users (user_id, username, display_name, avatar_hash, avatar_url)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       username = excluded.username,
       display_name = excluded.display_name,
       avatar_hash = excluded.avatar_hash,
       avatar_url = excluded.avatar_url,
       updated_at = datetime('now')`
  )
    .bind(profile.user_id, profile.username, profile.display_name, profile.avatar_hash, profile.avatar_url)
    .run();

  const sessionCookie = await createSession(env.DB, profile.user_id, request);
  return redirect("/", {
    "Set-Cookie": [
      sessionCookie,
      cookie(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/api/auth", secure: isSecureRequest(request) }),
    ],
  });
}
