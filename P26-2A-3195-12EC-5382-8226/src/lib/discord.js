/** Integração com a API OAuth2 do Discord. */

export const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
export const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
export const DISCORD_ME_URL = "https://discord.com/api/users/@me";
export const OAUTH_STATE_COOKIE = "ht_oauth_state";

export function redirectUri(request) {
  return new URL("/api/auth/discord/callback", request.url).href;
}

/**
 * URL do avatar no CDN do Discord. Sem avatar personalizado, usa o avatar padrão
 * (índice = (id >> 22) % 6 para contas no novo sistema de nomes de usuário).
 */
export function avatarUrl(userId, avatarHash) {
  if (avatarHash && /^(a_)?[0-9a-f]{32}$/i.test(avatarHash)) {
    const ext = avatarHash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=128`;
  }
  let index = 0;
  try {
    index = Number((BigInt(userId) >> 22n) % 6n);
  } catch {
    index = 0;
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

/** Converte a resposta de /users/@me no formato salvo no D1. */
export function profileFromDiscord(me) {
  if (!me || typeof me.id !== "string" || !/^\d{5,25}$/.test(me.id) || typeof me.username !== "string") {
    return null;
  }
  return {
    user_id: me.id,
    username: me.username.slice(0, 64),
    display_name: typeof me.global_name === "string" ? me.global_name.slice(0, 64) : null,
    avatar_hash: typeof me.avatar === "string" ? me.avatar : null,
    avatar_url: avatarUrl(me.id, me.avatar),
  };
}
