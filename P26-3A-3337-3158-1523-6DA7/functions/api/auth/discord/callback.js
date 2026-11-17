import {
  json,
  buildCookie,
  getCookie,
  getSecret,
  createSessionToken,
  ensureSchema,
  upsertDiscordUser,
  SESSION_COOKIE,
  STATE_COOKIE,
  SESSION_TTL_SECONDS,
} from "../../../_utils.js";

function redirect(origin, path, cookies = []) {
  const headers = new Headers({
    Location: new URL(path, origin).href,
    "Cache-Control": "no-store",
  });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

/**
 * /api/auth/discord/callback — valida o `state`, troca o code pelo token, le o perfil (@me:
 * user_id, username, avatar), grava em discord_users (D1) e cria a sessao assinada.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const clearState = buildCookie(STATE_COOKIE, "", { maxAge: 0, path: "/api/auth/discord" });

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (error || !code) {
    // nao repassa texto arbitrario da query para a interface: so codigos conhecidos
    const reason = error ? (error === "access_denied" ? "access_denied" : "oauth_error") : "missing_code";
    return redirect(url.origin, "/?auth_error=" + reason, [clearState]);
  }

  const state = url.searchParams.get("state");
  const savedState = getCookie(request, STATE_COOKIE);
  if (!state || !savedState || state !== savedState) {
    return redirect(url.origin, "/?auth_error=invalid_state", [clearState]);
  }

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !getSecret(env)) {
    return json(
      {
        ok: false,
        error: "missing_credentials",
        message: "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages.",
      },
      500
    );
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
      return redirect(url.origin, "/?auth_error=token_exchange_failed", [clearState]);
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
      return redirect(url.origin, "/?auth_error=fetch_user_failed", [clearState]);
    }

    const discordUser = await userRes.json();
    const userId = String(discordUser.id || "");
    if (!/^\d{5,25}$/.test(userId)) {
      return redirect(url.origin, "/?auth_error=invalid_user", [clearState]);
    }
    const username = String(discordUser.global_name || discordUser.username || "Estudante").slice(0, 80);
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";
    const user = { userId, username, avatar };

    if (env.DB) {
      try {
        await ensureSchema(env);
        await upsertDiscordUser(env, user);
      } catch {
        // o login nao depende do D1; o usuario e gravado de novo ao registrar a primeira atividade
      }
    }

    const token = await createSessionToken(user, env);
    return redirect(url.origin, "/?login=success", [
      buildCookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS }),
      clearState,
    ]);
  } catch {
    return redirect(url.origin, "/?auth_error=exception", [clearState]);
  }
}
