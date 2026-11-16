/**
 * GET /api/auth/discord/callback
 * Valida o state, troca o code pelo token, importa user_id, nome, avatar e servidores
 * do Discord para o D1 e cria a sessão (cookie HttpOnly com token aleatório).
 */
import { OAUTH_COOKIE } from "../../../../src/config.js";
import { exchangeCode, fetchProfile, safeReturnTo, saveProfile } from "../../../../src/discord.js";
import { cookie, getCookie, methodNotAllowed, redirect } from "../../../../src/http.js";
import { createSession } from "../../../../src/session.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clearOauth = cookie(OAUTH_COOKIE, "", 0);
  const fail = (reason) => redirect(`/?auth_error=${reason}`, [clearOauth]);

  if (url.searchParams.get("error")) return fail(url.searchParams.get("error") === "access_denied" ? "cancelado" : "discord");

  let saved = null;
  try {
    saved = JSON.parse(getCookie(request, OAUTH_COOKIE) || "null");
  } catch {
    saved = null;
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !saved || saved.state !== state) return fail("state");
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return fail("config");

  const accessToken = await exchangeCode(env, url.origin, code);
  if (!accessToken) return fail("token");
  const profile = await fetchProfile(accessToken);
  if (!profile) return fail("perfil");

  await saveProfile(env, profile);
  const sessionCookie = await createSession(env, profile.id);
  return redirect(safeReturnTo(saved.returnTo), [clearOauth, sessionCookie]);
}

export const onRequest = () => methodNotAllowed();
