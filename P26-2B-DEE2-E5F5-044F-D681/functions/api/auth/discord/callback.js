/**
 * GET /api/auth/discord/callback
 * Valida o state, troca o "code" por um access_token, busca /users/@me no Discord,
 * grava/atualiza o usuário no D1 (user_id, username, nome, avatar) e abre a sessão.
 */
import { parseCookies, cookie } from "../../../_lib/http.js";
import { criarSessao } from "../../../_lib/auth.js";

function voltar(origin, motivo, extraCookies = []) {
  const headers = new Headers({ Location: `${origin}/${motivo ? `?auth_error=${encodeURIComponent(motivo)}` : ""}`, "Cache-Control": "no-store" });
  headers.append("Set-Cookie", cookie("oauth_state", "", { maxAge: 0 }));
  for (const c of extraCookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const erroDiscord = url.searchParams.get("error");

  if (erroDiscord) return voltar(origin, erroDiscord === "access_denied" ? "cancelado" : "discord_erro");
  if (!code || !state) return voltar(origin, "parametros_ausentes");

  const stateCookie = parseCookies(request).oauth_state;
  if (!stateCookie || stateCookie !== state) return voltar(origin, "state_invalido");

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return voltar(origin, "discord_nao_configurado");

  // 1. troca o code pelo token
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin}/api/auth/discord/callback`,
    }),
  });
  if (!tokenRes.ok) {
    console.error("Discord token error", tokenRes.status, await tokenRes.text());
    return voltar(origin, "troca_token_falhou");
  }
  const { access_token } = await tokenRes.json();

  // 2. busca o perfil
  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!meRes.ok) return voltar(origin, "perfil_falhou");
  const me = await meRes.json();
  if (!me?.id || !me?.username) return voltar(origin, "perfil_invalido");

  // 3. salva / atualiza o usuário no D1
  await env.DB.prepare(
    `INSERT INTO discord_users (user_id, username, global_name, avatar)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       username = excluded.username,
       global_name = excluded.global_name,
       avatar = excluded.avatar,
       updated_at = datetime('now')`
  )
    .bind(String(me.id), String(me.username), me.global_name ? String(me.global_name) : null, me.avatar || null)
    .run();

  // 4. abre a sessão
  const cookieSessao = await criarSessao(env, String(me.id));
  return voltar(origin, "", [cookieSessao]);
}
