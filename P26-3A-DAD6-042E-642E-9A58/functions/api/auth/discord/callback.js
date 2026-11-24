import { isToken, sha256Base64Url, timingSafeEqual } from "../../../_shared/crypto.js";
import {
  NEXT_COOKIE,
  TX_COOKIE,
  clearNextCookie,
  clearTxCookie,
  parseCookies,
  sessionCookie,
} from "../../../_shared/cookies.js";
import {
  OAuthError,
  discordConfig,
  exchangeCode,
  fetchProfile,
  revokeToken,
  safeNext,
} from "../../../_shared/discord.js";
import { methodNotAllowed, redirect } from "../../../_shared/http.js";
import { createSession } from "../../../_shared/session.js";

// GET /api/auth/discord/callback?code=...&state=...
export async function onRequestGet({ request, env }) {
  const clearTx = [clearTxCookie(), clearNextCookie()];
  try {
    const config = discordConfig(env);
    const cookies = parseCookies(request);
    const code = await verifyTransaction(request, env, cookies);

    // Troca o código, lê o perfil e revoga o access token logo em seguida.
    const tokens = await exchangeCode(config, code);
    let profile;
    try {
      profile = await fetchProfile(tokens.access_token);
    } finally {
      await revokeToken(config, tokens.access_token);
    }

    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO discord_users (user_id, username, global_name, avatar, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (user_id) DO UPDATE SET
         username = excluded.username,
         global_name = excluded.global_name,
         avatar = excluded.avatar,
         updated_at = excluded.updated_at`,
    )
      .bind(profile.user_id, profile.username, profile.global_name, profile.avatar, now)
      .run();

    const sessionId = await createSession(env, profile.user_id);
    let next = null;
    try {
      next = safeNext(decodeURIComponent(cookies[NEXT_COOKIE] || ""));
    } catch {
      next = null;
    }
    return redirect(next || "/", [...clearTx, sessionCookie(sessionId)]);
  } catch (error) {
    // Só o código interno vai para o log: nunca code, state, tokens ou cookies.
    const code = error instanceof OAuthError ? error.code : "login_failed";
    console.error(`discord callback: ${code}`);
    return redirect(`/?erro=${code}`, clearTx);
  }
}

export function onRequest() {
  return methodNotAllowed("GET");
}

// Confere cookie + state e consome a transação (uso único). Devolve o code.
async function verifyTransaction(request, env, cookies) {
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  if (providerError) throw new OAuthError(providerError === "access_denied" ? "access_denied" : "oauth_error");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || code.length > 512 || state.length > 512) throw new OAuthError("invalid_callback");

  const txId = cookies[TX_COOKIE];
  if (!isToken(txId)) throw new OAuthError("missing_transaction");

  const txHash = await sha256Base64Url(txId);
  const tx = await env.DB.prepare("SELECT state_hash FROM oauth_states WHERE id_hash = ?1 AND expires_at > ?2")
    .bind(txHash, Date.now())
    .first();
  if (!tx) throw new OAuthError("invalid_transaction");

  // Apaga a transação ANTES de trocar o código: o state não pode ser reutilizado.
  const deleted = await env.DB.prepare("DELETE FROM oauth_states WHERE id_hash = ?1").bind(txHash).run();
  if (deleted && deleted.meta && typeof deleted.meta.changes === "number" && deleted.meta.changes !== 1) {
    throw new OAuthError("invalid_transaction");
  }

  const stateHash = await sha256Base64Url(state);
  if (!timingSafeEqual(stateHash, tx.state_hash)) throw new OAuthError("invalid_state");
  return code;
}
