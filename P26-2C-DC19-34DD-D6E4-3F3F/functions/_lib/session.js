// Sessões: o cookie guarda o token; o D1 guarda só o SHA-256 (hex).
import { parseCookies, serializeCookie, ehHttps, bytesHex } from "./http.js";

export const SESSAO_SEGUNDOS = 7 * 24 * 60 * 60;
const TOKEN_RE = /^[0-9a-f]{64}$/;

export async function sha256Hex(texto) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, "0")).join("");
}

// Cria a sessão e devolve o valor do header Set-Cookie.
export async function criarSessao(env, request, userId) {
  const token = bytesHex(32);
  const hash = await sha256Hex(token);
  const agora = new Date();
  const expira = new Date(agora.getTime() + SESSAO_SEGUNDOS * 1000);
  // Limpeza oportunista: remove sessões já expiradas para a tabela não crescer sem limite.
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(agora.toISOString()).run();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(hash, userId, expira.toISOString(), agora.toISOString())
    .run();
  const cookie = serializeCookie("sid", token, { maxAge: SESSAO_SEGUNDOS, secure: ehHttps(request) });
  return { token, cookie, expiresAt: expira.toISOString() };
}

// Devolve { id, username, avatar_url } ou null (ignora sessões expiradas).
export async function usuarioDaSessao(env, request) {
  const token = parseCookies(request).sid;
  if (!token || !TOKEN_RE.test(token)) return null;
  const hash = await sha256Hex(token);
  const linha = await env.DB.prepare(
    "SELECT u.id, u.username, u.avatar_url FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?"
  )
    .bind(hash, new Date().toISOString())
    .first();
  return linha || null;
}

// Apaga a sessão (se houver) e devolve o Set-Cookie que limpa o cookie.
export async function encerrarSessao(env, request) {
  const token = parseCookies(request).sid;
  if (token && TOKEN_RE.test(token)) {
    const hash = await sha256Hex(token);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hash).run();
  }
  return serializeCookie("sid", "", { maxAge: 0, secure: ehHttps(request) });
}
