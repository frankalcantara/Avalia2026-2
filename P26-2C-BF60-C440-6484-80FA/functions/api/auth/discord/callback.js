// GET /api/auth/discord/callback — confere state, troca code por token, importa o perfil,
// faz upsert em users, cria sessão opaca e redireciona para /?login=ok.
import { errorResponse, route } from "../../../../src/http.js";
import { parseCookies, STATE_COOKIE, safeEqual, sessionCookie, clearStateCookie, discordConfigured } from "../../../../src/auth.js";
import { exchangeCode, fetchDiscordUser, mapDiscordUser, upsertUserAndCreateSession, AuthFailure } from "../../../../src/discord.js";

function redirect(location, cookies) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

const fail = (code) => redirect(`/?auth_error=${encodeURIComponent(code)}`, [clearStateCookie()]);

export const onRequestGet = route(async ({ request, env }) => {
  if (!discordConfigured(env)) {
    return errorResponse(500, "not_configured", "Login Discord não configurado: defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET.");
  }
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError) return fail(/^[a-z_]{1,40}$/.test(oauthError) ? oauthError : "oauth_error");

  // CSRF do OAuth: o state da URL precisa bater com o cookie HttpOnly.
  const state = url.searchParams.get("state") || "";
  const expected = parseCookies(request)[STATE_COOKIE] || "";
  if (!expected || !safeEqual(state, expected)) return fail("invalid_state");

  const code = url.searchParams.get("code");
  if (!code || code.length > 200) return fail("missing_code");

  try {
    const accessToken = await exchangeCode(env, request.url, code);
    const user = mapDiscordUser(await fetchDiscordUser(accessToken));
    const token = await upsertUserAndCreateSession(env, user);
    return redirect("/?login=ok", [sessionCookie(token), clearStateCookie()]);
  } catch (err) {
    if (err instanceof AuthFailure) return fail(err.code);
    console.error("Falha no callback do Discord:", err && err.stack ? err.stack : err);
    return fail("server_error");
  }
});
