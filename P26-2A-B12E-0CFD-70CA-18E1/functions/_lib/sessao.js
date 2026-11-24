/**
 * Sessões opacas armazenadas no D1.
 *
 * O cookie carrega um token aleatório de 32 bytes. O banco guarda apenas o
 * SHA-256 do token, então um vazamento do D1 não permite sequestrar sessões.
 * O cookie é HttpOnly, SameSite=Lax e Secure em produção (HTTPS).
 */

import { apagarSessao, buscarSessao, criarSessao } from "./db.js";
import { randomHex, sha256Hex } from "./crypto.js";
import { apagarCookie, criarCookie, lerCookie, ErroHttp } from "./http.js";

export const COOKIE_SESSAO = "sorteio_sessao";
export const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;

/** Só marca Secure quando a requisição é HTTPS (permite testar em localhost). */
function ehHttps(request) {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return true;
  }
}

function opcoesCookie(request) {
  return {
    httpOnly: true,
    secure: ehHttps(request),
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(DURACAO_SESSAO_MS / 1000),
  };
}

/**
 * Cria a sessão no D1 e devolve o cookie pronto para o cabeçalho Set-Cookie.
 * @returns {Promise<{ token: string, cookie: string, expiresAt: string }>}
 */
export async function iniciarSessao(env, request, userId) {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + DURACAO_SESSAO_MS).toISOString();

  await criarSessao(env, {
    tokenHash,
    userId,
    expiresAt,
    userAgent: (request.headers.get("User-Agent") || "").slice(0, 255) || null,
  });

  return {
    token,
    expiresAt,
    cookie: criarCookie(COOKIE_SESSAO, token, opcoesCookie(request)),
  };
}

/**
 * Lê o cookie, valida no D1 e devolve o usuário público.
 * @returns {Promise<null | { tokenHash: string, user: { userId: string, username: string, globalName: string|null, avatar: string|null } }>}
 */
export async function sessaoAtual(request, env) {
  const token = lerCookie(request, COOKIE_SESSAO);
  if (!token || token.length !== 64) return null;

  const tokenHash = await sha256Hex(token);
  const linha = await buscarSessao(env, tokenHash);
  if (!linha) return null;

  return {
    tokenHash,
    user: {
      userId: linha.user_id,
      username: linha.username,
      globalName: linha.global_name ?? null,
      avatar: linha.avatar ?? null,
    },
  };
}

/** Igual a sessaoAtual, mas responde 401 quando não há sessão válida. */
export async function exigirSessao(request, env) {
  const sessao = await sessaoAtual(request, env);
  if (!sessao) {
    throw new ErroHttp(401, "nao_autenticado", "Faça login com o Discord para continuar.");
  }
  return sessao;
}

/** Remove a sessão do D1 e devolve o cookie já expirado. */
export async function encerrarSessao(request, env) {
  const token = lerCookie(request, COOKIE_SESSAO);
  if (token && token.length === 64) {
    await apagarSessao(env, await sha256Hex(token));
  }
  return apagarCookie(COOKIE_SESSAO, { ...opcoesCookie(request), maxAge: 0 });
}
