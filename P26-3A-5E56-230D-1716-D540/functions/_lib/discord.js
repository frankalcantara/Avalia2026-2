/** Discord OAuth2 — configuração, URLs e normalização do perfil. */

export const DISCORD_AUTHORIZE = "https://discord.com/oauth2/authorize";
export const DISCORD_TOKEN = "https://discord.com/api/oauth2/token";
export const DISCORD_ME = "https://discord.com/api/users/@me";
const PLACEHOLDER_CLIENT_ID = "PREENCHER_CLIENT_ID";

export function oauthConfigurado(env) {
  return Boolean(
    env.DISCORD_CLIENT_ID &&
      env.DISCORD_CLIENT_ID !== PLACEHOLDER_CLIENT_ID &&
      env.DISCORD_CLIENT_SECRET,
  );
}

/** redirect_uri idêntico ao cadastrado no portal: origem da própria requisição + caminho fixo. */
export function redirectUri(request) {
  return new URL("/api/auth/discord/callback", new URL(request.url).origin).href;
}

function avatarUrl(id, hash) {
  if (typeof hash === "string" && /^(a_)?[0-9a-f]{32}$/.test(hash)) {
    return `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=128`;
  }
  return `https://cdn.discordapp.com/embed/avatars/${(BigInt(id) >> 22n) % 6n}.png`;
}

function textoCurto(v, max) {
  if (typeof v !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const limpo = v.replace(/[\u0000-\u001F\u007F-\u009F‪-‮⁦-⁩]/g, "").trim();
  return limpo === "" ? null : [...limpo].slice(0, max).join("");
}

/** Converte o JSON de /users/@me no registro de `usuarios`, ou null se vier inválido. */
export function perfilDoDiscord(me) {
  if (!me || typeof me.id !== "string" || !/^\d{5,25}$/.test(me.id)) return null;
  const username = textoCurto(me.username, 64);
  if (!username) return null;
  return {
    user_id: me.id,
    username,
    nome_exibicao: textoCurto(me.global_name, 64) || username,
    avatar_url: avatarUrl(me.id, me.avatar),
  };
}
