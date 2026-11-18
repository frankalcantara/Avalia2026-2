/**
 * Helpers de ambiente e requisição HTTP para a suíte de testes.
 *
 * Sem rede, sem timers: cada teste recebe um `env` novo (D1 em memória já
 * migrado) e constrói `Request` nativas — exatamente o que as Pages Functions
 * recebem em produção (`context.request` / `context.env`).
 *
 * @module tests/helpers/env
 */

import { createD1 } from "./d1-mock.mjs";
import { createSession } from "../../functions/api/_lib/session.js";

/** Origem usada nas requisições simuladas (mesma origem ⇒ CORS liberado). */
export const BASE_URL = "http://localhost:8788";

/** Segredo HMAC válido usado nos testes (>= 32 caracteres). */
export const TEST_SESSION_SECRET = "s3gredo-de-teste-com-64-caracteres-para-hmac-sha256-ok!!";

/** Usuário padrão das fixtures. */
export const USER_A = Object.freeze({
  userId: "100000000000000001",
  username: "leo",
  avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
});

/** Segundo usuário (para cenários de autorização). */
export const USER_B = Object.freeze({
  userId: "200000000000000002",
  username: "ana",
  avatar: "https://cdn.discordapp.com/embed/avatars/1.png",
});

/**
 * Cria o objeto `env` das Pages Functions com D1 falso já migrado.
 *
 * @param {Record<string, unknown>} [overrides] Sobrescreve/aumenta bindings.
 * @returns {{ DB: import("./d1-mock.mjs").MockD1, SESSION_SECRET: string, DISCORD_CLIENT_ID: string, DISCORD_CLIENT_SECRET: string, ALLOWED_ORIGINS?: string }} Bindings do teste.
 */
export function makeEnv(overrides = {}) {
  return {
    DB: createD1(),
    SESSION_SECRET: TEST_SESSION_SECRET,
    DISCORD_CLIENT_ID: "test-client-id",
    DISCORD_CLIENT_SECRET: "test-client-secret",
    ...overrides,
  };
}

/**
 * Serializa cookies para o header `Cookie`.
 *
 * @param {string | Record<string, string> | Array<string> | undefined} cookies Cookie(s) informados.
 * @returns {string | null} Header pronto ou `null` quando não há cookies.
 */
function toCookieHeader(cookies) {
  if (!cookies) return null;
  if (typeof cookies === "string") return cookies;
  if (Array.isArray(cookies)) return cookies.join("; ");
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(String(value))}`)
    .join("; ");
}

/**
 * Constrói uma `Request` nativa para os handlers.
 *
 * `Origin` é preenchido com a própria origem por padrão (comportamento do
 * browser), mantendo o middleware de CORS satisfeito quando exercitado.
 *
 * @param {string} url URL absoluta ou caminho relativo a `BASE_URL`.
 * @param {{
 *   method?: string,
 *   body?: unknown,
 *   rawBody?: string,
 *   headers?: Record<string, string>,
 *   cookies?: string | Record<string, string> | Array<string>,
 *   origin?: string | null
 * }} [options] Opções da requisição.
 * @returns {Request} Requisição pronta.
 */
export function makeRequest(url, options = {}) {
  const absolute = /^https?:\/\//i.test(url) ? url : `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  const { method = "GET", body, rawBody, headers = {}, cookies, origin } = options;

  const finalHeaders = new Headers(headers);
  const requestOrigin = origin === undefined ? new URL(absolute).origin : origin;
  if (requestOrigin && !finalHeaders.has("Origin")) {
    finalHeaders.set("Origin", requestOrigin);
  }

  const cookieHeader = toCookieHeader(cookies);
  if (cookieHeader && !finalHeaders.has("Cookie")) {
    finalHeaders.set("Cookie", cookieHeader);
  }

  let payload;
  if (rawBody !== undefined) {
    payload = rawBody;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    if (!finalHeaders.has("Content-Type")) {
      finalHeaders.set("Content-Type", "application/json");
    }
  }

  if (payload !== undefined && !finalHeaders.has("Content-Length")) {
    finalHeaders.set("Content-Length", String(new TextEncoder().encode(payload).length));
  }

  const init = { method, headers: finalHeaders };
  if (payload !== undefined && method !== "GET" && method !== "HEAD") {
    init.body = payload;
  }
  return new Request(absolute, init);
}

/**
 * Cria um cookie de sessão assinado para o usuário informado.
 *
 * @param {{ SESSION_SECRET: string }} env Bindings (usa `SESSION_SECRET`).
 * @param {{ userId: string, username?: string, avatar?: string }} user Usuário da sessão.
 * @returns {Promise<string>} Apenas o token (o header Cookie é montado por `toCookieHeader`).
 */
export async function sessionCookie(env, user) {
  return createSession(
    { userId: user.userId, username: user.username ?? "", avatar: user.avatar ?? "" },
    env.SESSION_SECRET,
  );
}

/**
 * Monta o contexto (`context`) esperado pelas Pages Functions.
 *
 * @param {{ request: Request, env: Record<string, unknown>, params?: Record<string, string> }} parts Partes do contexto.
 * @returns {{ request: Request, env: Record<string, unknown>, params: Record<string, string>, data: Record<string, unknown> }} Contexto.
 */
export function makeContext({ request, env, params = {} }) {
  return { request, env, params, data: {} };
}

/**
 * Lê o corpo JSON de uma `Response`.
 *
 * @param {Response} response Resposta HTTP.
 * @returns {Promise<any>} Corpo parseado.
 */
export async function readJson(response) {
  return response.json();
}
