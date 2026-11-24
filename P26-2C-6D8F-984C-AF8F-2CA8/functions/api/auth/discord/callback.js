/**
 * GET /api/auth/discord/callback — confere `state`, troca o code, faz upsert do perfil
 * e cria sessão opaca (token aleatório de 32 bytes na tabela sessions, 30 dias).
 */
import { lerCookie, tokenAleatorio, cookie } from "../../../_util.js";

const TRINTA_DIAS = 30 * 24 * 3600;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const falha = (motivo) => {
    const h = new Headers({ Location: `${url.origin}/?auth_error=${encodeURIComponent(motivo)}` });
    h.append("Set-Cookie", cookie("oauth_state", "", 0));
    return new Response(null, { status: 302, headers: h });
  };

  try {
    if (url.searchParams.get("error")) return falha(url.searchParams.get("error"));
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const esperado = lerCookie(request, "oauth_state");
    if (!code) return falha("missing_code");
    if (!state || !esperado || state !== esperado) return falha("state_invalido");
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return falha("discord_nao_configurado");

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${url.origin}/api/auth/discord/callback`,
      }),
    });
    if (!tokenRes.ok) return falha("token_exchange_failed");
    const { access_token } = await tokenRes.json();

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) return falha("fetch_user_failed");
    const du = await userRes.json();

    const userId = String(du.id);
    const username = du.global_name || du.username;
    const avatar = du.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${du.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";
    const sid = tokenAleatorio(32);

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP`
      ).bind(userId, username, avatar),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at <= datetime('now')").bind(userId),
      env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))")
        .bind(sid, userId),
    ]);

    const h = new Headers({ Location: `${url.origin}/` });
    h.append("Set-Cookie", cookie("sid", sid, TRINTA_DIAS));
    h.append("Set-Cookie", cookie("oauth_state", "", 0));
    return new Response(null, { status: 302, headers: h });
  } catch (err) {
    console.error(err);
    return falha("exception");
  }
}
