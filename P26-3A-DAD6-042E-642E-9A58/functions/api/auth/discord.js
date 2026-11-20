import { randomToken, sha256Base64Url } from "../../_shared/crypto.js";
import { TX_MAX_AGE, clearNextCookie, nextCookie, txCookie } from "../../_shared/cookies.js";
import { OAuthError, authorizeUrl, discordConfig, safeNext } from "../../_shared/discord.js";
import { methodNotAllowed, redirect } from "../../_shared/http.js";
import { purgeExpired } from "../../_shared/session.js";

// GET /api/auth/discord[?next=/#/evento/12]
// Cria uma transação OAuth de uso único e redireciona para o Discord.
export async function onRequestGet({ request, env }) {
  try {
    const config = discordConfig(env);
    const txId = randomToken();
    const state = randomToken();
    const now = Date.now();

    // Limpeza oportunista de transações e sessões vencidas.
    await purgeExpired(env);
    await env.DB.prepare("INSERT INTO oauth_states (id_hash, state_hash, expires_at) VALUES (?1, ?2, ?3)")
      .bind(await sha256Base64Url(txId), await sha256Base64Url(state), now + TX_MAX_AGE * 1000)
      .run();

    const next = safeNext(new URL(request.url).searchParams.get("next"));
    const cookies = [txCookie(txId), next ? nextCookie(next) : clearNextCookie()];
    return redirect(authorizeUrl(config, state), cookies);
  } catch (error) {
    const code = error instanceof OAuthError ? error.code : "login_failed";
    console.error(`discord login: ${code}`);
    return redirect(`/?erro=${code}`);
  }
}

export function onRequest() {
  return methodNotAllowed("GET");
}
