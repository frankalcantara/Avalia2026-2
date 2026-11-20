import { erro, lerCookie } from "./http.js";

const DURACAO_SEGUNDOS = 7 * 24 * 60 * 60;

async function sha256(texto) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function tokenAleatorio() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function cookieSessao(token, maxAge = DURACAO_SEGUNDOS) {
  return `sessao=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function cookieSessaoVazio() {
  return cookieSessao("", 0);
}

export async function criarSessao(db, usuarioId) {
  const token = tokenAleatorio();
  const expiraEm = Math.floor(Date.now() / 1000) + DURACAO_SEGUNDOS;
  await db
    .prepare("INSERT INTO sessoes (id_hash, usuario_id, expira_em) VALUES (?, ?, ?)")
    .bind(await sha256(token), usuarioId, expiraEm)
    .run();
  return token;
}

export async function encerrarSessao(db, request) {
  const token = lerCookie(request, "sessao");
  if (!token) return;
  await db.prepare("DELETE FROM sessoes WHERE id_hash = ?").bind(await sha256(token)).run();
}

export async function usuarioDaSessao(db, request) {
  const token = lerCookie(request, "sessao");
  if (!token) return null;
  const agora = Math.floor(Date.now() / 1000);
  const usuario = await db
    .prepare(
      `SELECT u.id, u.username, u.nome, u.avatar_url
         FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.id_hash = ? AND s.expira_em > ?`
    )
    .bind(await sha256(token), agora)
    .first();
  return usuario || null;
}

export async function exigirUsuario({ request, env }) {
  if (!env.DB) return { resposta: erro("Banco de dados D1 não configurado (binding DB).", 500) };
  const usuario = await usuarioDaSessao(env.DB, request);
  if (!usuario) return { resposta: erro("Faça login com o Discord para continuar.", 401) };
  return { usuario };
}
