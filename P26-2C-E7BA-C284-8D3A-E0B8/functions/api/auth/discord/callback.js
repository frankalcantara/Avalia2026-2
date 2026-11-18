/**
 * Cloudflare Pages Function — GET /api/auth/discord/callback
 * 1. Confere o "state" (anti-CSRF).
 * 2. Troca o authorization code pelo token do Discord.
 * 3. Busca o perfil (@me) e grava/atualiza o usuário no D1.
 * 4. Cria o cookie de sessão ASSINADO (HMAC) e redireciona para a home.
 */
import {
  createSessionValue,
  buildSessionCookie,
  buildClearCookie,
} from "../../../_lib/session.js";

function readCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return match ? match[1] : null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Redireciona sempre apagando o cookie do state, que só vale para uma tentativa.
  function redirectTo(path, extraCookie) {
    const headers = new Headers({ Location: path });
    headers.append("Set-Cookie", buildClearCookie("oauth_state"));
    if (extraCookie) headers.append("Set-Cookie", extraCookie);
    return new Response(null, { status: 302, headers });
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const stateParam = url.searchParams.get("state");
  const stateCookie = readCookie(request, "oauth_state");

  if (error || !code) {
    return redirectTo("/?auth_error=" + encodeURIComponent(error || "missing_code"));
  }

  // Proteção CSRF: o state da URL precisa ser igual ao do cookie.
  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return redirectTo("/?auth_error=invalid_state");
  }

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) {
    return Response.json({
      ok: false,
      error: "missing_credentials",
      message: "Defina DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET e SESSION_SECRET nas variáveis do Cloudflare Pages (.dev.vars no ambiente local).",
    }, { status: 500 });
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

    if (!tokenRes.ok) {
      return redirectTo("/?auth_error=token_exchange_failed");
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return redirectTo("/?auth_error=fetch_user_failed");
    }

    const discordUser = await userRes.json();
    const userId = discordUser.id;
    const username = discordUser.global_name || discordUser.username;
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    // A tabela discord_users vem da migration 0001; não é mais criada aqui.
    try {
      await env.DB.prepare(
        "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) " +
        "ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
      ).bind(userId, username, avatar).run();
    } catch (dbErr) {
      console.error("Falha ao gravar usuário no D1:", dbErr);
      return redirectTo("/?auth_error=db_error");
    }

    const sessionValue = await createSessionValue({ userId, username, avatar }, env.SESSION_SECRET);
    return redirectTo("/?login=success", buildSessionCookie(sessionValue));
  } catch (err) {
    console.error("Erro no callback OAuth:", err);
    return redirectTo("/?auth_error=exception");
  }
}