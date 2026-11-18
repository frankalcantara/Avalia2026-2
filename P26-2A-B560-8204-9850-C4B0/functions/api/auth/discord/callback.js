/**
 * Cloudflare Pages Function — `GET /api/auth/discord/callback`
 *
 * Passo 2 do Authorization Code Flow:
 *  * valida o `state` contra o cookie `oauth_state` (CSRF);
 *  * troca o `code` por `access_token` (POST form-urlencoded, timeout 10s);
 *  * lê `GET https://discord.com/api/users/@me`;
 *  * faz UPSERT enxuto em `discord_users`;
 *  * emite cookie de sessão HMAC-SHA256 e redireciona para `/?login=ok`.
 *
 * Nenhum token/segredo é logado. Erros de fluxo voltam como
 * `/?login=error&reason=<code>`.
 *
 * @module functions/api/auth/discord/callback
 */

import { canonicalOrigin, fail } from "../../_lib/http.js";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSession,
  isValidSessionSecret,
  parseCookies,
  serializeCookie,
  timingSafeEqualString,
} from "../../_lib/session.js";

/** Timeout das chamadas ao Discord (evita consumir CPU/tempo do Worker). */
const DISCORD_TIMEOUT_MS = 10000;

/** Tamanho máximo aceito do `code` do Discord. */
const MAX_CODE_LENGTH = 512;

/**
 * Sanitiza o motivo de erro devolvido ao front (allowlist de caracteres).
 *
 * @param {string} reason Motivo bruto.
 * @returns {string} Motivo seguro (<= 40 chars).
 */
function safeReason(reason) {
  const fallback = "oauth_error";
  if (typeof reason !== "string") return fallback;
  const normalized = reason.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
  return normalized || fallback;
}

/**
 * Monta a URL do avatar do Discord (hash real ou índice padrão calculado do id).
 *
 * @param {{ id: string, avatar: string | null }} discordUser Usuário retornado por `/users/@me`.
 * @returns {string} URL absoluta da imagem.
 */
function buildAvatarUrl(discordUser) {
  if (discordUser.avatar) {
    return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`;
  }

  let index = 0;
  try {
    index = Number((BigInt(discordUser.id) >> 22n) % 6n);
  } catch {
    index = 0;
  }
  if (!Number.isInteger(index) || index < 0 || index > 5) index = 0;

  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

/**
 * Cria um redirect 302 aplicando/limpando cookies.
 *
 * @param {string} location Destino.
 * @param {string[]} setCookies Valores de `Set-Cookie`.
 * @returns {Response} Resposta de redirecionamento.
 */
function redirectWithCookies(location, setCookies = []) {
  const headers = new Headers();
  headers.set("Location", location);
  for (const cookie of setCookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

/**
 * Redireciona para o front com erro e limpa o cookie de `state`.
 *
 * @param {string} origin Origem da aplicação.
 * @param {string} reason Motivo (sanitizado).
 * @returns {Response} 302.
 */
function errorRedirect(origin, reason) {
  const target = new URL(`/?login=error&reason=${safeReason(reason)}`, origin);
  return redirectWithCookies(target.pathname + target.search, [
    serializeCookie(OAUTH_STATE_COOKIE, "", { maxAge: 0 }),
  ]);
}

/**
 * `GET /api/auth/discord/callback`
 *
 * @param {{ request: Request, env: Record<string, unknown> }} context Contexto do Pages Functions.
 * @returns {Promise<Response>} Redirect 302 (sucesso/erro) ou JSON de erro de configuração.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const oauthError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const cookies = parseCookies(request.headers.get("Cookie"));
  const stateCookie = cookies[OAUTH_STATE_COOKIE];

  // 1. Usuário negou a autorização / Discord devolveu erro.
  if (oauthError) {
    return errorRedirect(url.origin, oauthError);
  }

  // 2. CSRF: o `state` do query string deve bater com o cookie HttpOnly.
  if (!stateParam || !stateCookie || !timingSafeEqualString(stateParam, stateCookie)) {
    const response = fail(400, "invalid_state", "Estado OAuth inválido ou expirado. Reinicie o login.");
    // Higiene: `state` inválido também descarta o cookie para não deixá-lo
    // reaproveitável durante os 10 minutos de validade.
    response.headers.append("Set-Cookie", serializeCookie(OAUTH_STATE_COOKIE, "", { maxAge: 0 }));
    return response;
  }

  if (!code || code.length > MAX_CODE_LENGTH) {
    return errorRedirect(url.origin, "missing_code");
  }

  const clientId = typeof env?.DISCORD_CLIENT_ID === "string" ? env.DISCORD_CLIENT_ID.trim() : "";
  const clientSecret = typeof env?.DISCORD_CLIENT_SECRET === "string" ? env.DISCORD_CLIENT_SECRET.trim() : "";
  if (!clientId || !clientSecret) {
    return fail(
      503,
      "discord_not_configured",
      "O login com Discord não está configurado neste ambiente (credenciais ausentes).",
    );
  }

  // 3. Segredo de sessão é obrigatório: nunca há fallback hardcoded.
  if (!isValidSessionSecret(env?.SESSION_SECRET)) {
    return fail(
      500,
      "session_secret_missing",
      "SESSION_SECRET não configurado (mínimo de 32 caracteres). O login está indisponível.",
    );
  }
  const sessionSecret = /** @type {string} */ (env.SESSION_SECRET);

  const redirectUri = new URL("/api/auth/discord/callback", canonicalOrigin(env, url)).href;

  // 4. Troca do authorization code por access token.
  /** @type {{ access_token?: string }} */
  let tokenData;
  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });

    if (!tokenResponse.ok) {
      return errorRedirect(url.origin, "token_exchange_failed");
    }
    tokenData = await tokenResponse.json();
  } catch {
    return errorRedirect(url.origin, "token_exchange_failed");
  }

  const accessToken = typeof tokenData?.access_token === "string" ? tokenData.access_token : "";
  if (!accessToken) {
    return errorRedirect(url.origin, "token_missing");
  }

  // 5. Perfil do usuário autenticado.
  /** @type {{ id?: unknown, username?: unknown, global_name?: unknown, avatar?: unknown }} */
  let discordUser;
  try {
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });

    if (!userResponse.ok) {
      return errorRedirect(url.origin, "user_fetch_failed");
    }
    discordUser = await userResponse.json();
  } catch {
    return errorRedirect(url.origin, "user_fetch_failed");
  }

  const userId = typeof discordUser?.id === "string" ? discordUser.id : "";
  if (!userId || !/^\d{5,32}$/.test(userId)) {
    return errorRedirect(url.origin, "user_invalid");
  }

  const discordUsername = typeof discordUser.username === "string" ? discordUser.username.slice(0, 100) : "";
  const globalName = typeof discordUser.global_name === "string" ? discordUser.global_name.slice(0, 100) : null;
  const displayName = (globalName || discordUsername || "Usuário Discord").slice(0, 100);
  const avatar = buildAvatarUrl({
    id: userId,
    avatar: typeof discordUser.avatar === "string" ? discordUser.avatar : null,
  });

  // 6. UPSERT enxuto (1 leitura + 1 escrita no login).
  const db = env?.DB;
  if (db && typeof db.prepare === "function") {
    try {
      await db
        .prepare(
          `INSERT INTO discord_users (user_id, username, global_name, avatar, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET
             username = excluded.username,
             global_name = excluded.global_name,
             avatar = excluded.avatar,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(userId, discordUsername || displayName, globalName, avatar)
        .run();
    } catch {
      console.error("Falha ao persistir o usuário do Discord no D1.");
      return errorRedirect(url.origin, "db_error");
    }
  }

  // 7. Sessão assinada + limpeza do cookie de state.
  let sessionToken;
  try {
    sessionToken = await createSession({ userId, username: displayName, avatar }, sessionSecret);
  } catch {
    return fail(500, "session_creation_failed", "Não foi possível criar a sessão.");
  }

  return redirectWithCookies("/?login=ok", [
    serializeCookie(SESSION_COOKIE, sessionToken, { maxAge: SESSION_TTL_SECONDS }),
    serializeCookie(OAUTH_STATE_COOKIE, "", { maxAge: 0 }),
  ]);
}

/**
 * Qualquer método diferente de GET → 405 em JSON.
 *
 * @returns {Response} 405 `method_not_allowed`.
 */
export function onRequest() {
  return fail(405, "method_not_allowed", "Método não permitido para este endpoint.");
}
