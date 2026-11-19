/**
 * Cloudflare Pages Function — /api/auth/discord/callback
 * Valida o `state` (CSRF), troca o authorization code pelo token de acesso do
 * Discord, obtém o perfil (@me), persiste no Cloudflare D1 e grava uma sessão
 * assinada (HMAC-SHA256) no cookie HttpOnly.
 */

import {
  cookieSessao,
  criarSessao,
  estadoValido,
  limparCookieEstado,
} from "../../_lib/session.js";

function redirecionar(url, destino, setCookies = []) {
  const headers = new Headers();
  headers.set("Location", new URL(destino, url.origin).href);
  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 302, headers });
}

function erroJson(status, erro, mensagem) {
  const resposta = Response.json(
    { ok: false, error: erro, message: mensagem },
    { status }
  );
  resposta.headers.append("Set-Cookie", limparCookieEstado());
  return resposta;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  if (error || !code) {
    return redirecionar(url, "/?auth_error=" + encodeURIComponent(error || "missing_code"), [
      limparCookieEstado(),
    ]);
  }

  // CSRF: o `state` recebido precisa bater com o cookie curto criado em
  // /api/auth/discord. Sem isso, o `code` NUNCA é trocado.
  if (!estadoValido(request, state)) {
    return redirecionar(url, "/?auth_error=invalid_state", [limparCookieEstado()]);
  }

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return erroJson(
      500,
      "missing_credentials",
      "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages (Settings -> Environment variables)."
    );
  }

  if (!env.SESSION_SECRET) {
    return erroJson(
      500,
      "missing_session_secret",
      "Defina SESSION_SECRET nas variáveis do Cloudflare Pages para assinar a sessão."
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
      return redirecionar(url, "/?auth_error=token_exchange_failed", [
        limparCookieEstado(),
      ]);
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return redirecionar(url, "/?auth_error=fetch_user_failed", [
        limparCookieEstado(),
      ]);
    }

    const discordUser = await userRes.json();
    const userId = discordUser.id;
    const username = discordUser.global_name || discordUser.username;
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    if (env.DB) {
      try {
        await env.DB.prepare(
          "CREATE TABLE IF NOT EXISTS discord_users (user_id TEXT PRIMARY KEY, username TEXT NOT NULL, avatar TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ).run();
        await env.DB.prepare(
          "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
        ).bind(userId, username, avatar).run();
      } catch {}
    }

    const sessaoAssinada = await criarSessao(env, { userId, username, avatar });

    return redirecionar(url, "/?login=success", [
      limparCookieEstado(),
      cookieSessao(sessaoAssinada),
    ]);
  } catch (err) {
    return redirecionar(url, "/?auth_error=exception", [limparCookieEstado()]);
  }
}
