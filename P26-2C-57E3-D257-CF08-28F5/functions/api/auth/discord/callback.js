import {
  clearStateCookie,
  consumeStateCookie,
  createSessionCookie,
} from "../../../_shared/session.js";
import { json, redirect } from "../../../_shared/http.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const fail = (message, status) =>
    json({ error: message }, status, { "Set-Cookie": clearStateCookie() });

  if (
    !env.DISCORD_CLIENT_ID ||
    !env.DISCORD_CLIENT_SECRET ||
    !env.SESSION_SECRET ||
    new TextEncoder().encode(env.SESSION_SECRET).length < 32 ||
    !env.DB
  ) {
    return fail("Autenticação Discord ou banco D1 não configurado corretamente.", 503);
  }

  const state = url.searchParams.get("state");
  if (!(await consumeStateCookie(request, state, env.SESSION_SECRET))) {
    return fail("Estado OAuth inválido ou expirado.", 400);
  }
  if (url.searchParams.has("error")) {
    return redirect("/?auth=discord_error", { "Set-Cookie": clearStateCookie() });
  }

  const code = url.searchParams.get("code");
  if (!code) return fail("Código de autorização ausente.", 400);

  let failureMessage = "Falha ao concluir a autenticação Discord.";
  let failureStatus = 502;
  try {
    const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) {
      return fail("O Discord não autorizou esta sessão.", 401);
    }
    const token = await tokenResponse.json();
    if (typeof token.access_token !== "string" || !token.access_token) {
      return fail("Resposta de autenticação inválida do Discord.", 502);
    }

    failureMessage = "Não foi possível consultar o perfil do Discord.";
    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) return fail(failureMessage, 502);

    const profile = await profileResponse.json();
    if (
      typeof profile.id !== "string" ||
      !/^\d+$/.test(profile.id) ||
      typeof profile.username !== "string" ||
      !profile.username.trim()
    ) {
      return fail("O perfil retornado pelo Discord está incompleto.", 502);
    }

    const user = {
      id: profile.id,
      username: profile.username,
      avatar_url: profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${encodeURIComponent(profile.avatar)}.png?size=96`
        : `https://cdn.discordapp.com/embed/avatars/${Number(profile.id) % 6}.png`,
    };

    failureMessage = "Não foi possível registrar o usuário no banco D1.";
    failureStatus = 500;
    await env.DB.prepare(
      `INSERT INTO discord_users (user_id, username, avatar)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         username = excluded.username,
         avatar = excluded.avatar,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
      .bind(user.id, user.username, user.avatar_url)
      .run();

    failureMessage = "Não foi possível criar a sessão autenticada.";
    const response = redirect("/");
    response.headers.append("Set-Cookie", await createSessionCookie(user, env.SESSION_SECRET));
    response.headers.append("Set-Cookie", clearStateCookie());
    return response;
  } catch {
    return fail(failureMessage, failureStatus);
  }
}
