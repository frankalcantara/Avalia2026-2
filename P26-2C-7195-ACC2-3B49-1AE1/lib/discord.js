// Cliente mínimo do OAuth2 do Discord (escopo "identify").

const API = 'https://discord.com/api';
const call = (...args) => fetch(...args);

export function buildAuthorizeUrl(clientId, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'identify',
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function exchangeCode({ clientId, clientSecret, code, redirectUri }) {
  const res = await call(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`discord_token_${res.status}`);
  const data = await res.json();
  if (typeof data.access_token !== 'string') throw new Error('discord_token_missing');
  return data.access_token;
}

/** Retorna { id, username, displayName, avatar } do usuário autenticado no Discord. */
export async function fetchDiscordUser(accessToken) {
  const res = await call(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`discord_user_${res.status}`);
  const u = await res.json();
  if (typeof u.id !== 'string' || !/^\d{1,25}$/.test(u.id) || typeof u.username !== 'string') {
    throw new Error('discord_user_invalid');
  }
  return {
    id: u.id,
    username: u.username.slice(0, 100),
    displayName: typeof u.global_name === 'string' ? u.global_name.slice(0, 100) : null,
    avatar: typeof u.avatar === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(u.avatar) ? u.avatar : null,
  };
}

/** URL do avatar no CDN do Discord (ou avatar padrão quando o usuário não tem um). */
export function avatarUrl(userId, avatarHash) {
  if (avatarHash && /^[A-Za-z0-9_]{1,64}$/.test(avatarHash)) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=128`;
  }
  let index = 0;
  try {
    index = Number((BigInt(userId) >> 22n) % 6n);
  } catch {
    /* id inesperado: usa o avatar 0 */
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
