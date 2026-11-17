/**
 * Cloudflare Pages Function — /api/auth/discord/callback
 * Confere o state, troca o code pelo token, busca o perfil (@me),
 * grava no D1 e cria um cookie de sessão ASSINADO.
 */
import { signSession, getCookie } from "../../../../lib/session.js";

const APAGA_STATE = "oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure";

// Falha de login: volta para a página com um código curto e apaga o state.
function fail(motivo) {
  const headers = new Headers();
  headers.append("Location", "/?auth_error=" + encodeURIComponent(motivo));
  headers.append("Set-Cookie", APAGA_STATE);
  headers.append("Cache-Control", "no-store");
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) return fail("login_cancelado");

  // Confere o state: o que voltou do Discord precisa ser igual ao do cookie.
  const stateUrl = url.searchParams.get("state");
  const stateCookie = getCookie(request, "oauth_state");
  if (!stateUrl || !stateCookie || stateUrl !== stateCookie) return fail("invalid_state");

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET || !env.DB) {
    console.error("Configuração incompleta: faltam variáveis ou o binding DB.");
    return fail("config");
  }

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
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
    if (!tokenRes.ok) return fail("token_exchange_failed");

    const tokenData = await tokenRes.json();
    if (typeof tokenData.access_token !== "string" || !tokenData.access_token) {
      return fail("token_exchange_failed");
    }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) return fail("fetch_user_failed");

    const discordUser = await userRes.json();
    // O id do Discord é um número grande, mas chega como texto de dígitos.
    if (typeof discordUser.id !== "string" || !/^\d{5,25}$/.test(discordUser.id)) {
      return fail("fetch_user_failed");
    }

    const userId = discordUser.id;
    const username = String(discordUser.global_name || discordUser.username || "Usuário").slice(0, 80);
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    // Se o banco falhar, o login falha: não deixamos entrar uma sessão que quebraria depois.
    try {
      await env.DB.prepare(
        "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
      ).bind(userId, username, avatar).run();
    } catch (e) {
      console.error("Falha ao gravar o usuário:", e);
      return fail("db_error");
    }

    // Sessão assinada, válida por 24 horas.
    const exp = Math.floor(Date.now() / 1000) + 86400;
    const session = await signSession({ userId, username, avatar, exp }, env.SESSION_SECRET);

    // Dois Set-Cookie: grava a sessão e apaga o oauth_state (uso único).
    const headers = new Headers();
    headers.append("Location", "/?login=success");
    headers.append("Set-Cookie", `discord_session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400; Secure`);
    headers.append("Set-Cookie", APAGA_STATE);
    headers.append("Cache-Control", "no-store");
    return new Response(null, { status: 302, headers });
  } catch (err) {
    console.error("Erro no callback:", err);
    return fail("exception");
  }
}