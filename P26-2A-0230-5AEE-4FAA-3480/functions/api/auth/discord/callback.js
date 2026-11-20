import {
  authCookie, checkAuthConfig, nowInSeconds, OAUTH_CALLBACK, OAUTH_COOKIE, readCookie,
  SESSION_COOKIE, SESSION_SECONDS, signToken, verifyToken,
} from "../../../_lib/auth.js";
import { database, redirect } from "../../../_lib/http.js";

const DISCORD_API = "https://discord.com/api/v10";

async function getDiscordProfile(request, env, code) {
  const tokenResponse = await fetch(DISCORD_API + "/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: new URL(OAUTH_CALLBACK, request.url).href,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!tokenResponse.ok) throw new Error("Falha ao trocar o código OAuth do Discord.");

  const { access_token: accessToken } = await tokenResponse.json();
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("O Discord não retornou um token válido.");
  }

  const profileResponse = await fetch(DISCORD_API + "/users/@me", {
    headers: { Authorization: "Bearer " + accessToken },
    signal: AbortSignal.timeout(10000),
  });
  if (!profileResponse.ok) throw new Error("Falha ao buscar o perfil do Discord.");

  const profile = await profileResponse.json();
  if (typeof profile.id !== "string" || !/^\d{1,20}$/.test(profile.id) ||
    typeof profile.username !== "string" || !profile.username.trim()) {
    throw new Error("O Discord não retornou um perfil válido.");
  }
  return profile;
}

function avatarUrl(profile) {
  if (typeof profile.avatar === "string" && /^(a_)?[a-f0-9]{32}$/i.test(profile.avatar)) {
    return "https://cdn.discordapp.com/avatars/" + profile.id + "/" + profile.avatar + ".png?size=128";
  }
  const discriminator = Number(profile.discriminator) || 0;
  const index = discriminator === 0 ? Number((BigInt(profile.id) >> 22n) % 6n) : discriminator % 5;
  return "https://cdn.discordapp.com/embed/avatars/" + index + ".png";
}

export async function onRequestGet({ request, env }) {
  const parameters = new URL(request.url).searchParams;
  const clearState = authCookie(request, OAUTH_COOKIE, "", 0);

  try {
    checkAuthConfig(env);
    const state = await verifyToken(env, "oauth", readCookie(request, OAUTH_COOKIE));
    if (!state || state !== parameters.get("state")) {
      return redirect(request, "/?auth=error", [clearState]);
    }
    if (parameters.get("error") === "access_denied") {
      return redirect(request, "/?auth=denied", [clearState]);
    }
    const code = parameters.get("code");
    if (!code || parameters.has("error")) {
      return redirect(request, "/?auth=error", [clearState]);
    }

    const profile = await getDiscordProfile(request, env, code);
    const db = database(env);
    const now = nowInSeconds();
    const sessionId = crypto.randomUUID();
    const sessionToken = await signToken(env, "session", sessionId);

    await db.batch([
      db.prepare(
        "INSERT INTO discord_users (user_id, username, avatar) VALUES (?, ?, ?)" +
          " ON CONFLICT(user_id) DO UPDATE SET username = excluded.username," +
          " avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP",
      ).bind(profile.id, profile.username, avatarUrl(profile)),
      db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
      db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
        .bind(sessionId, profile.id, now + SESSION_SECONDS),
    ]);

    const session = authCookie(request, SESSION_COOKIE, sessionToken, SESSION_SECONDS);
    return redirect(request, "/", [clearState, session]);
  } catch (error) {
    console.error("Falha no fluxo OAuth do Discord:", error instanceof Error ? error.message : "erro inesperado");
    return redirect(request, "/?auth=error", [clearState]);
  }
}
