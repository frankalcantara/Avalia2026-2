const INVITE_RE = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,32}$/;

/** Retorna DISCORD_INVITE_URL só se casar com o formato permitido; senão null. */
export function inviteUrl(env) {
  const v = env?.DISCORD_INVITE_URL;
  return typeof v === "string" && INVITE_RE.test(v.trim()) ? v.trim() : null;
}
