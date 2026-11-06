/**
 * Sessões de login e dados do usuário do Discord.
 * O cookie "sid" carrega um token aleatório de 256 bits; no D1 fica apenas o SHA-256 dele,
 * então quem ler o banco não consegue se passar por ninguém.
 */
import { parseCookies, cookie } from "./http.js";

export const SESSAO_DIAS = 7;
export const COOKIE_SESSAO = "sid";

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function tokenAleatorio(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return hex(arr);
}

export async function sha256(valor) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(valor)));
}

/** URL pública do avatar do Discord (ou avatar padrão quando o usuário não tem foto). */
export function avatarUrl(userId, avatar) {
  if (avatar) {
    const ext = avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=128`;
  }
  let indice = 0;
  try {
    indice = Number((BigInt(userId) >> 22n) % 6n);
  } catch {}
  return `https://cdn.discordapp.com/embed/avatars/${indice}.png`;
}

export function usuarioPublico(row) {
  if (!row) return null;
  return {
    user_id: row.user_id,
    username: row.username,
    nome: row.global_name || row.username,
    avatar: row.avatar,
    avatar_url: avatarUrl(row.user_id, row.avatar),
  };
}

/** Cria sessão no D1 e devolve o cabeçalho Set-Cookie. */
export async function criarSessao(env, userId) {
  const token = tokenAleatorio();
  const expira = new Date(Date.now() + SESSAO_DIAS * 86400 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), userId, expira)
    .run();
  // aproveita para limpar sessões vencidas
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(new Date().toISOString()).run();
  return cookie(COOKIE_SESSAO, token, { maxAge: SESSAO_DIAS * 86400 });
}

/** Retorna o usuário logado (linha de discord_users) ou null. */
export async function usuarioDaSessao(request, env) {
  const token = parseCookies(request)[COOKIE_SESSAO];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await env.DB.prepare(
    `SELECT u.user_id, u.username, u.global_name, u.avatar
       FROM sessions s JOIN discord_users u ON u.user_id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(await sha256(token), new Date().toISOString())
    .first();
  return row || null;
}

export async function encerrarSessao(request, env) {
  const token = parseCookies(request)[COOKIE_SESSAO];
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  }
  return cookie(COOKIE_SESSAO, "", { maxAge: 0 });
}
