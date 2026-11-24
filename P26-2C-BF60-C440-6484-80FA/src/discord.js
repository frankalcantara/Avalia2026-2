// Integração Discord OAuth2 (scope=identify).
import { randomToken, SESSION_MAX_AGE } from "./auth.js";

export const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const ME_URL = "https://discord.com/api/users/@me";

export function redirectUri(requestUrl) {
  return new URL("/api/auth/discord/callback", new URL(requestUrl).origin).href;
}

export function buildAuthorizeUrl(env, requestUrl, state) {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  u.searchParams.set("redirect_uri", redirectUri(requestUrl));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "identify");
  u.searchParams.set("state", state);
  return u.href;
}

// Falha de OAuth com código curto (vai para /?auth_error=<codigo>).
export class AuthFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export async function exchangeCode(env, requestUrl, code) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(requestUrl),
    }),
  });
  if (!res.ok) throw new AuthFailure("token_exchange_failed");
  const data = await res.json().catch(() => null);
  if (!data || typeof data.access_token !== "string") throw new AuthFailure("token_exchange_failed");
  return data.access_token;
}

export async function fetchDiscordUser(accessToken) {
  const res = await fetch(ME_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new AuthFailure("fetch_user_failed");
  const u = await res.json().catch(() => null);
  if (!u || typeof u.id !== "string" || !/^[0-9]{1,25}$/.test(u.id) || typeof u.username !== "string") {
    throw new AuthFailure("invalid_user");
  }
  return u;
}

// Mapeia o perfil do Discord para a tabela users.
export function mapDiscordUser(u) {
  let avatarUrl;
  if (typeof u.avatar === "string" && /^[A-Za-z0-9_]+$/.test(u.avatar)) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`;
  } else {
    const idx = (BigInt(u.id) >> 22n) % 6n;
    avatarUrl = `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }
  const displayName = typeof u.global_name === "string" && u.global_name.trim() ? u.global_name.trim().slice(0, 100) : null;
  return { user_id: u.id, username: u.username.slice(0, 100), display_name: displayName, avatar_url: avatarUrl };
}

// Upsert do usuário + nova sessão (e limpeza de sessões expiradas) numa transação.
export async function upsertUserAndCreateSession(env, user) {
  const token = randomToken(32);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (user_id, username, display_name, avatar_url) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, display_name = excluded.display_name,
         avatar_url = excluded.avatar_url, updated_at = datetime('now')`
    ).bind(user.user_id, user.username, user.display_name, user.avatar_url),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')"),
    env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?1, ?2, datetime('now', ?3))`)
      .bind(token, user.user_id, `+${SESSION_MAX_AGE} seconds`),
  ]);
  return token;
}
