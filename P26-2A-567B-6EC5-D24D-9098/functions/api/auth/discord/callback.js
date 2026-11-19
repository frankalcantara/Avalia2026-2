/**
 * Cloudflare Pages Function — /api/auth/discord/callback
 * Valida o `state`, troca o `code` por token, busca o perfil (@me), faz UPSERT em
 * discord_users, cria a sessão em `sessions` e define o cookie de sessão.
 */
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  STATE_COOKIE,
  STATE_COOKIE_PATH,
  buildCookie,
  clearCookie,
  parseCookies,
  randomHex,
  sqlTimestamp,
  timingSafeEqual,
} from "../../../_lib/auth.js";
import { methodNotAllowed, redirect } from "../../../_lib/http.js";

const SAFE_ERROR_CODE = /^[a-z_]{1,40}$/;
const SNOWFLAKE = /^\d{1,25}$/;
const AVATAR_HASH = /^[A-Za-z0-9_]{1,64}$/;

// Todo desfecho com erro volta para /?auth_error=... e descarta o cookie do state.
function fail(code) {
  return redirect("/?auth_error=" + encodeURIComponent(code), [clearCookie(STATE_COOKIE, STATE_COOKIE_PATH)]);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") return methodNotAllowed("GET");

  const url = new URL(request.url);

  // Erro devolvido pelo Discord (ex.: access_denied). Só códigos simples são repassados.
  const oauthError = url.searchParams.get("error");
  if (oauthError) return fail(SAFE_ERROR_CODE.test(oauthError) ? oauthError : "oauth_error");

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DB) return fail("not_configured");

  // 1) Validar o state (CSRF do OAuth2).
  const state = url.searchParams.get("state");
  const savedState = parseCookies(request)[STATE_COOKIE];
  if (!state || !savedState || !timingSafeEqual(state, savedState)) return fail("invalid_state");

  const code = url.searchParams.get("code");
  if (!code) return fail("missing_code");

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;

  try {
    // 2) Trocar o code pelo token.
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "DiscordBot (bookmark-manager, 1.0)",
      },
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
    if (!tokenData || typeof tokenData.access_token !== "string") return fail("token_exchange_failed");

    // 3) Buscar o perfil.
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
        "User-Agent": "DiscordBot (bookmark-manager, 1.0)",
      },
    });
    if (!userRes.ok) return fail("fetch_user_failed");

    const discordUser = await userRes.json();
    const userId = discordUser && typeof discordUser.id === "string" ? discordUser.id : "";
    const username = String((discordUser && (discordUser.global_name || discordUser.username)) || "")
      .trim()
      .slice(0, 80);
    if (!SNOWFLAKE.test(userId) || !username) return fail("fetch_user_failed");

    // O banco guarda só o hash do avatar (ou null); a URL é montada na resposta de /api/auth/me.
    const avatarHash =
      typeof discordUser.avatar === "string" && AVATAR_HASH.test(discordUser.avatar) ? discordUser.avatar : null;

    // 4) UPSERT do usuário + sessão nova (expires_at e created_at no mesmo formato, via sqlTimestamp).
    const now = new Date();
    const nowStamp = sqlTimestamp(now);
    const expiresAt = sqlTimestamp(new Date(now.getTime() + SESSION_TTL_SECONDS * 1000));
    const sessionId = randomHex(32);

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = excluded.updated_at"
      ).bind(userId, username, avatarHash, nowStamp),
      env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(nowStamp),
      env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(
        sessionId,
        userId,
        expiresAt,
        nowStamp
      ),
    ]);

    // 5) Cookie de sessão (só o id aleatório) e volta para a página inicial.
    return redirect("/?login=success", [
      buildCookie(SESSION_COOKIE, sessionId, { maxAge: SESSION_TTL_SECONDS }),
      clearCookie(STATE_COOKIE, STATE_COOKIE_PATH),
    ]);
  } catch {
    return fail("exception");
  }
}