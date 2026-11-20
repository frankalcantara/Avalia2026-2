// Fluxo OAuth2 do Discord (scope identify). O access_token nunca é guardado.

const AUTORIZAR = "https://discord.com/oauth2/authorize";
const TOKEN = "https://discord.com/api/oauth2/token";
const PERFIL = "https://discord.com/api/users/@me";

export function redirectUri(env, request) {
  return env.DISCORD_REDIRECT_URI || `${new URL(request.url).origin}/api/auth/callback`;
}

export function montarUrlAutorizacao({ clientId, redirectUri: ru, state }) {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: ru,
    response_type: "code",
    scope: "identify",
    state,
    prompt: "none",
  });
  return `${AUTORIZAR}?${p.toString()}`;
}

// Troca o code pelo access_token. Lança erro em qualquer falha.
export async function trocarCodigo(env, code, ru) {
  const corpo = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: ru,
  });
  const r = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: corpo.toString(),
  });
  if (!r.ok) throw new Error(`Discord token HTTP ${r.status}`);
  const d = await r.json();
  if (!d || typeof d.access_token !== "string") throw new Error("Resposta de token inválida");
  return d.access_token;
}

export async function buscarPerfil(accessToken) {
  const r = await fetch(PERFIL, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  if (!r.ok) throw new Error(`Discord perfil HTTP ${r.status}`);
  const d = await r.json();
  if (!d || typeof d.id !== "string" || !/^\d+$/.test(d.id)) throw new Error("Perfil inválido");
  return d;
}

export function avatarUrl(id, avatar) {
  if (avatar) return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=128`;
  return `https://cdn.discordapp.com/embed/avatars/${(BigInt(id) >> 22n) % 6n}.png`;
}

// Cria ou atualiza o usuário; devolve { id, username, avatar_url }.
export async function upsertUsuario(env, perfil) {
  const id = perfil.id;
  const username = String(perfil.global_name || perfil.username || "usuário").slice(0, 100);
  const avatar_url = avatarUrl(id, perfil.avatar);
  const agora = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO users (id, username, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET username = excluded.username, avatar_url = excluded.avatar_url, updated_at = excluded.updated_at`
  )
    .bind(id, username, avatar_url, agora, agora)
    .run();
  return { id, username, avatar_url };
}
