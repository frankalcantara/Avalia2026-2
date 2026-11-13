import {
  callbackUri,
  createSessionCookie,
  expiredOAuthCookie,
  requireDB,
  requireDiscordConfig,
  validateOAuthState,
} from "../../../_lib/auth.js";
import { errorResponse, json, methodNotAllowed } from "../../../_lib/http.js";

export async function onRequestGet({ request, env }) {
  try {
    requireDiscordConfig(env);
    const url = new URL(request.url);
    if (url.searchParams.has("error")) {
      return json(
        { error: "discord_authorization_denied", message: "A autorização do Discord não foi concluída." },
        400,
        { "Set-Cookie": expiredOAuthCookie() },
      );
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || code.length > 2048 || !(await validateOAuthState(request, env, state))) {
      return json(
        { error: "invalid_oauth_state", message: "Estado OAuth ausente ou inválido." },
        400,
        { "Set-Cookie": expiredOAuthCookie() },
      );
    }

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUri(request, env),
      }),
    });
    if (!tokenResponse.ok) {
      return json(
        { error: "discord_token_exchange_failed", message: "Não foi possível concluir a autenticação Discord." },
        502,
        { "Set-Cookie": expiredOAuthCookie() },
      );
    }
    const token = await tokenResponse.json();
    if (typeof token.access_token !== "string" || !token.access_token) {
      throw new Error("Discord returned no access token");
    }

    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) {
      return json(
        { error: "discord_profile_failed", message: "Não foi possível obter o perfil Discord." },
        502,
        { "Set-Cookie": expiredOAuthCookie() },
      );
    }
    const profile = await profileResponse.json();
    if (typeof profile.id !== "string" || !/^\d+$/.test(profile.id) ||
        typeof profile.username !== "string" || !profile.username.trim()) {
      throw new Error("Invalid Discord profile");
    }

    const username = profile.global_name || profile.username;
    const avatar = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(profile.id)}/${encodeURIComponent(profile.avatar)}.png`
      : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(profile.id) % 6n)}.png`;
    const db = requireDB(env);
    await db.prepare(
      "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP",
    ).bind(profile.id, username, avatar).run();

    const sessionCookie = await createSessionCookie(
      { user_id: profile.id, username, avatar },
      env,
    );
    const headers = new Headers({ Location: "/" });
    headers.append("Set-Cookie", sessionCookie);
    headers.append("Set-Cookie", expiredOAuthCookie());
    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest({ request }) {
  return methodNotAllowed(["GET"]);
}
