// Integração com o Discord OAuth2 (escopo identify, fluxo authorization code
// com state + Client Secret). O secret só é lido de env e nunca é registrado.

export const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
export const TOKEN_URL = "https://discord.com/api/oauth2/token";
export const USER_URL = "https://discord.com/api/users/@me";
export const REVOKE_URL = "https://discord.com/api/oauth2/token/revoke";

const USER_ID_PATTERN = /^[0-9]{1,25}$/;
const AVATAR_PATTERN = /^[A-Za-z0-9_]{1,64}$/;

export class OAuthError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function discordConfig(env) {
  const clientId = env && env.DISCORD_CLIENT_ID;
  const clientSecret = env && env.DISCORD_CLIENT_SECRET;
  const base = env && env.PUBLIC_BASE_URL;
  if (!clientId || !clientSecret || !base || !env.DB) throw new OAuthError("config");
  const baseUrl = String(base).replace(/\/+$/, "");
  return { clientId, clientSecret, redirectUri: `${baseUrl}/api/auth/discord/callback` };
}

export function authorizeUrl({ clientId, redirectUri }, state) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "identify");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

function form(values) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(values).toString(),
  };
}

export async function exchangeCode(config, code) {
  let response;
  try {
    response = await fetch(
      TOKEN_URL,
      form({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
    );
  } catch {
    throw new OAuthError("token_exchange_failed");
  }
  if (!response.ok) throw new OAuthError("token_exchange_failed");
  let tokens;
  try {
    tokens = await response.json();
  } catch {
    throw new OAuthError("token_exchange_failed");
  }
  const tokenType = tokens && typeof tokens.token_type === "string" ? tokens.token_type.toLowerCase() : "";
  if (!tokens || typeof tokens.access_token !== "string" || !tokens.access_token || tokenType !== "bearer") {
    throw new OAuthError("token_exchange_failed");
  }
  return tokens;
}

// GET /users/@me e normalização dos campos importados.
export async function fetchProfile(accessToken) {
  let response;
  try {
    response = await fetch(USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
  } catch {
    throw new OAuthError("profile_failed");
  }
  if (!response.ok) throw new OAuthError("profile_failed");
  let user;
  try {
    user = await response.json();
  } catch {
    throw new OAuthError("profile_failed");
  }
  const id = user && typeof user.id === "string" ? user.id : "";
  const username = user && typeof user.username === "string" ? user.username.trim().slice(0, 64) : "";
  if (!USER_ID_PATTERN.test(id) || !username) throw new OAuthError("profile_invalid");
  const globalName =
    typeof user.global_name === "string" && user.global_name.trim() ? user.global_name.trim().slice(0, 64) : null;
  const avatar = typeof user.avatar === "string" && AVATAR_PATTERN.test(user.avatar) ? user.avatar : null;
  return { user_id: id, username, global_name: globalName, avatar };
}

// Revoga o access token. Falha aqui não bloqueia o login (só registra o código).
export async function revokeToken(config, accessToken) {
  try {
    const response = await fetch(
      REVOKE_URL,
      form({
        token: accessToken,
        token_type_hint: "access_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    );
    if (!response.ok) console.warn("discord callback: revoke_failed");
  } catch {
    console.warn("discord callback: revoke_failed");
  }
}

export function avatarUrl(userId, avatar) {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${encodeURIComponent(userId)}/${encodeURIComponent(avatar)}.png?size=128`;
  }
  let index = 0n;
  try {
    index = (BigInt(userId) >> 22n) % 6n;
  } catch {
    index = 0n;
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

// Aceita só caminhos relativos ("/..."), nunca "//host" ou "/\host".
export function safeNext(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  return value;
}
