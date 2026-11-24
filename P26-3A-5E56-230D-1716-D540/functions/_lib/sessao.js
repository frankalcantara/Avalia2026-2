/**
 * Sessão (cookie "sessao") — criar, ler, apagar.
 *
 * FORMATO DO TOKEN E DO HASH (usado também pelos testes para semear sessões no D1 local):
 *  - Cookie:   sessao=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800 (7 dias)
 *  - <token>:  gerado com crypto.getRandomValues (32 bytes) em base64url sem padding (43 chars).
 *              O servidor aceita qualquer token com 16 a 128 caracteres de [A-Za-z0-9_-];
 *              outro formato é tratado como "sem sessão".
 *  - Banco:    sessoes.token_hash = SHA-256 dos bytes UTF-8 da STRING do token (exatamente como vai
 *              no cookie), em HEXADECIMAL MINÚSCULO (64 chars). O token em si nunca é gravado.
 *  - Validade: sessoes.expira_em no formato do SQLite 'YYYY-MM-DD HH:MM:SS' (UTC); a sessão vale
 *              enquanto datetime(expira_em) > datetime('now').
 *
 * Exemplo para semear no D1 local (token "tokenDeTesteUsuarioA0001"):
 *   HASH=$(printf %s 'tokenDeTesteUsuarioA0001' | sha256sum | cut -d' ' -f1)
 *   npx wrangler d1 execute DB --local --command "
 *     INSERT INTO usuarios (user_id, username, nome_exibicao, avatar_url)
 *       VALUES ('100000000000000001', 'usuario_a', 'Usuário A', 'https://cdn.discordapp.com/embed/avatars/0.png');
 *     INSERT INTO sessoes (token_hash, user_id, expira_em)
 *       VALUES ('$HASH', '100000000000000001', datetime('now', '+1 day'));"
 *   curl -H 'Cookie: sessao=tokenDeTesteUsuarioA0001' http://localhost:8788/api/me
 */

export const COOKIE_SESSAO = "sessao";
export const COOKIE_STATE = "oauth_state";
export const DURACAO_SESSAO_S = 7 * 24 * 60 * 60;
export const DURACAO_STATE_S = 10 * 60;
// Escopo do cookie de state: só a rota de login e o callback o recebem.
export const PATH_STATE = "/api/auth/discord";

const RE_TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

function base64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 32 bytes aleatórios criptográficos em base64url. */
export function tokenAleatorio() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** SHA-256 (hex minúsculo) da string UTF-8. */
export async function sha256Hex(texto) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparação em tempo constante: compara os SHA-256 das duas strings com timingSafeEqual. */
export async function iguaisTempoConstante(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

/** Lê um cookie pelo nome do cabeçalho Cookie. */
export function lerCookie(request, nome) {
  const cabecalho = request.headers.get("Cookie");
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(";")) {
    const i = parte.indexOf("=");
    if (i === -1) continue;
    if (parte.slice(0, i).trim() === nome) return parte.slice(i + 1).trim();
  }
  return null;
}

export function cookie(nome, valor, { maxAge, path = "/" }) {
  return `${nome}=${valor}; HttpOnly; Secure; SameSite=Lax; Path=${path}; Max-Age=${maxAge}`;
}

export function cookieExpirado(nome, path = "/") {
  return `${nome}=; HttpOnly; Secure; SameSite=Lax; Path=${path}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/** Token do cookie de sessão, se tiver formato válido. */
export function tokenDoCookie(request) {
  const t = lerCookie(request, COOKIE_SESSAO);
  return t && RE_TOKEN.test(t) ? t : null;
}

/** Usuário da sessão válida (não expirada) ou null. */
export async function usuarioDaSessao(env, request) {
  const token = tokenDoCookie(request);
  if (!token) return null;
  const hash = await sha256Hex(token);
  const linha = await env.DB.prepare(
    `SELECT u.user_id, u.username, u.nome_exibicao, u.avatar_url
       FROM sessoes s JOIN usuarios u ON u.user_id = s.user_id
      WHERE s.token_hash = ? AND datetime(s.expira_em) > datetime('now')`,
  )
    .bind(hash)
    .first();
  return linha || null;
}

/**
 * Cria sessão para o usuário. Devolve { token, statements } — os statements entram no mesmo
 * batch do upsert do usuário. Também limpa sessões expiradas desse usuário.
 */
export async function prepararNovaSessao(env, userId) {
  const token = tokenAleatorio();
  const hash = await sha256Hex(token);
  const statements = [
    env.DB.prepare(`DELETE FROM sessoes WHERE user_id = ? AND datetime(expira_em) <= datetime('now')`).bind(userId),
    env.DB.prepare(
      `INSERT INTO sessoes (token_hash, user_id, expira_em) VALUES (?, ?, datetime('now', '+7 days'))`,
    ).bind(hash, userId),
  ];
  return { token, statements };
}

/** Apaga do D1 a sessão do cookie atual (se houver). */
export async function apagarSessaoAtual(env, request) {
  const token = tokenDoCookie(request);
  if (!token) return;
  await env.DB.prepare(`DELETE FROM sessoes WHERE token_hash = ?`).bind(await sha256Hex(token)).run();
}
