import {
  avatarUrl,
  callbackUrl,
  clearAuthCookies,
  configuredOAuth,
  getSessionSecret,
  json,
  makeSessionCookie,
  methodNotAllowed,
  verifyOAuthState,
} from "../../../_shared/auth.js";

function failure(message, status) {
  const headers = new Headers();
  clearAuthCookies(headers);
  return json({ error: message }, status, headers);
}

async function providerJson(response, context) {
  try {
    return await response.json();
  } catch (error) {
    console.error(`Could not parse ${context} response from Discord.`, error);
    return null;
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return methodNotAllowed("GET");

  let secret;
  let oauth;
  try {
    secret = getSessionSecret(env);
    oauth = configuredOAuth(env);
  } catch (error) {
    console.error("Could not read Discord OAuth configuration.", error);
    return failure("Autenticação Discord não configurada.", 500);
  }

  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return failure("A autenticação Discord foi cancelada ou recusada.", 400);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (
    !code ||
    code.length > 2048 ||
    !state ||
    state.length > 256 ||
    !(await verifyOAuthState(request, state, secret))
  ) {
    return failure("Resposta OAuth inválida ou expirada. Tente entrar novamente.", 400);
  }
  if (!env.DB) return failure("Banco de dados indisponível.", 503);

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: oauth.clientId,
        client_secret: oauth.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl(request),
      }),
    });
    const tokenData = await providerJson(tokenResponse, "OAuth token");
    if (
      !tokenResponse.ok ||
      typeof tokenData?.access_token !== "string" ||
      !tokenData.access_token
    ) {
      return failure("Não foi possível concluir a autenticação Discord.", 502);
    }

    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await providerJson(profileResponse, "profile");
    if (
      !profileResponse.ok ||
      typeof profile?.id !== "string" ||
      !/^\d{1,32}$/.test(profile.id) ||
      typeof profile?.username !== "string" ||
      profile.username.trim().length === 0 ||
      profile.username.length > 80
    ) {
      return failure("Não foi possível validar o perfil Discord.", 502);
    }

    const avatar = avatarUrl(profile.id, profile.avatar);
    try {
      await env.DB.prepare(
        `INSERT INTO users (id, discord_id, username, avatar, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(discord_id) DO UPDATE SET
           username = excluded.username,
           avatar = excluded.avatar,
           updated_at = CURRENT_TIMESTAMP`,
      ).bind(profile.id, profile.id, profile.username, avatar).run();
    } catch (error) {
      console.error("Could not persist Discord profile to D1.", error);
      return failure("Não foi possível registrar o perfil Discord.", 500);
    }

    const user = await env.DB.prepare(
      "SELECT id, username, avatar FROM users WHERE discord_id = ?",
    ).bind(profile.id).first();
    if (!user) throw new Error("Discord user could not be loaded after upsert.");

    const headers = new Headers({
      Location: "/",
      "Cache-Control": "no-store",
    });
    clearAuthCookies(headers);
    headers.append("Set-Cookie", await makeSessionCookie({
      user_id: user.id,
      username: user.username,
      avatar: user.avatar,
    }, secret));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error("Discord OAuth callback failed.", error);
    return failure("Falha ao concluir a autenticação Discord.", 502);
  }
}
