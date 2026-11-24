/**
 * Middleware exclusivo de `/api/*` (Cloudflare Pages Functions).
 *
 * Responsabilidades:
 *  1. CORS rigoroso com allowlist (`env.ALLOWED_ORIGINS`) — nunca `*` com credenciais.
 *  2. Preflight `OPTIONS` → 204 com métodos/headers exatos.
 *  3. Anti-CSRF: exige que a `Origin` de métodos mutantes seja confiável.
 *  4. Rate limit em memória por isolate (protege D1 e a própria cota de Functions).
 *  5. Headers de segurança + `Cache-Control: no-store` em todas as respostas JSON.
 *
 * Ficar em `functions/api/_middleware.js` evita que ativos estáticos de `public/`
 * consumam a cota de 100k invocações/dia do plano gratuito.
 *
 * @module functions/api/_middleware
 */

import { clientIp, fail } from "./_lib/http.js";

/** Janela do rate limit em milissegundos. */
const RATE_WINDOW_MS = 60_000;

/** Limite de requisições de leitura por IP/janela. */
const READ_LIMIT = 120;

/** Limite de requisições de escrita por IP/janela. */
const WRITE_LIMIT = 30;

/** Nº máximo de IPs rastreados simultaneamente (evita crescimento ilimitado). */
const MAX_BUCKETS = 5000;

/** Métodos aceitos pela API. */
const ALLOWED_METHODS = "GET, POST, DELETE, OPTIONS";

/** Headers aceitos pela API. */
const ALLOWED_HEADERS = "Content-Type";

/** Headers de hardening aplicados a toda resposta da API. */
const SECURITY_HEADERS = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  "Cache-Control": "no-store",
});

/**
 * Estado do rate limit por isolate: ip → janela corrente e contadores.
 * @type {Map<string, { start: number, read: number, write: number }>}
 */
const buckets = new Map();

/**
 * Lista as origens permitidas configuradas no ambiente.
 *
 * @param {Record<string, unknown>} env Bindings do Pages Functions.
 * @returns {string[]} Origens sem espaços vazios.
 */
function configuredOrigins(env) {
  const raw = typeof env?.ALLOWED_ORIGINS === "string" ? env.ALLOWED_ORIGINS : "";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Decide se uma `Origin` é confiável (mesma origem ou allowlist explícita).
 *
 * @param {string} origin Origem recebida no header.
 * @param {string} requestOrigin Origem da própria requisição.
 * @param {Record<string, unknown>} env Bindings.
 * @returns {boolean} `true` quando confiável.
 */
function isTrustedOrigin(origin, requestOrigin, env) {
  if (!origin) return false;
  if (origin === requestOrigin) return true;
  return configuredOrigins(env).includes(origin);
}

/**
 * Remove janelas expiradas de forma preguiçosa (sem timers no isolate).
 *
 * @param {number} now Timestamp atual.
 */
function pruneBuckets(now) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.start >= RATE_WINDOW_MS) buckets.delete(key);
  }
}

/**
 * Consome uma unidade do rate limit do IP.
 *
 * @param {string} ip IP do cliente.
 * @param {boolean} isWrite `true` para métodos mutantes.
 * @returns {{ limited: boolean, retryAfter: number }} Veredito e segundos de espera.
 */
function consumeRateLimit(ip, isWrite) {
  const now = Date.now();

  if (buckets.size >= MAX_BUCKETS) {
    pruneBuckets(now);
    if (buckets.size >= MAX_BUCKETS) {
      // Nunca limpar o mapa inteiro: um atacante distribuído (> MAX_BUCKETS IPs
      // em 60 s) conseguiria resetar o limiter de TODOS e obter rajada livre.
      // Descartamos apenas as janelas mais antigas (ordem de inserção do Map).
      let toEvict = Math.ceil(MAX_BUCKETS / 4);
      for (const key of buckets.keys()) {
        if (toEvict <= 0) break;
        buckets.delete(key);
        toEvict -= 1;
      }
    }
  }

  let bucket = buckets.get(ip);
  if (!bucket || now - bucket.start >= RATE_WINDOW_MS) {
    bucket = { start: now, read: 0, write: 0 };
    buckets.set(ip, bucket);
  }

  if (isWrite) bucket.write += 1;
  else bucket.read += 1;

  const count = isWrite ? bucket.write : bucket.read;
  const limit = isWrite ? WRITE_LIMIT : READ_LIMIT;

  if (count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.start + RATE_WINDOW_MS - now) / 1000));
    return { limited: true, retryAfter };
  }
  return { limited: false, retryAfter: 0 };
}

/**
 * Aplica CORS + hardening a uma resposta qualquer.
 *
 * @param {Response} response Resposta original.
 * @param {Record<string, string>} corsHeaders Headers CORS resolvidos.
 * @returns {Response} Nova resposta com os headers finais.
 */
function finalize(response, corsHeaders) {
  const headers = new Headers(response.headers);

  // Preserva múltiplos `Set-Cookie` (ex.: sessão + limpeza do cookie `oauth_state`),
  // que a iteração padrão de Headers combina em um único valor.
  if (typeof response.headers.getSetCookie === "function") {
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length > 1) {
      headers.delete("Set-Cookie");
      for (const cookie of setCookies) headers.append("Set-Cookie", cookie);
    }
  }

  for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Handler do middleware.
 *
 * @param {{ request: Request, env: Record<string, unknown>, next: () => Promise<Response> }} context
 * @returns {Promise<Response>} Resposta final com CORS e headers de segurança.
 */
export async function onRequest(context) {
  const { request, env, next } = context;
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin");

  /** @type {Record<string, string>} */
  const corsHeaders = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": "600",
  };

  // Allowlist estrita: qualquer origem desconhecida é rejeitada antes de tocar no D1.
  if (origin) {
    if (!isTrustedOrigin(origin, requestOrigin, env)) {
      return finalize(fail(403, "origin_not_allowed", "Origem não autorizada para este recurso."), corsHeaders);
    }
    corsHeaders["Access-Control-Allow-Origin"] = origin;
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  }

  if (request.method === "OPTIONS") {
    return finalize(new Response(null, { status: 204 }), corsHeaders);
  }

  const isWrite = request.method !== "GET" && request.method !== "HEAD";

  // Anti-CSRF explícito: métodos mutantes exigem Origin confiável quando presente.
  // (Clientes não-browser sem Origin seguem — a autorização real é feita pela sessão HMAC.)
  if (isWrite && origin && !isTrustedOrigin(origin, requestOrigin, env)) {
    return finalize(fail(403, "csrf_origin_mismatch", "Origem da requisição não confiável."), corsHeaders);
  }

  const verdict = consumeRateLimit(clientIp(request), isWrite);
  if (verdict.limited) {
    const response = fail(429, "rate_limited", "Muitas requisições. Tente novamente em instantes.");
    response.headers.set("Retry-After", String(verdict.retryAfter));
    return finalize(response, corsHeaders);
  }

  let response;
  try {
    response = await next();
  } catch {
    console.error("Falha inesperada ao processar uma requisição de /api/*.");
    response = fail(500, "internal_error", "Erro interno ao processar a requisição.");
  }

  return finalize(response, corsHeaders);
}
