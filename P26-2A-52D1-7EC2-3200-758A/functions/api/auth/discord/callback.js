/**
 * GET /api/auth/discord/callback
 * Recebe o "code" do Discord, confere o "state", troca o code por um token de acesso,
 * busca o perfil (@me) e importa user_id, nome e avatar para o Cloudflare D1.
 * Depois cria uma sessão no D1: o cookie guarda só um token aleatório, nunca os dados do usuário.
 */
import { criarSessao, lerCookie, montarCookie } from "../../../../lib/servidor.js";

function voltarComErro(origem, motivo) {
  const headers = new Headers({ Location: `${origem}/?erro_login=${encodeURIComponent(motivo)}` });
  headers.append("Set-Cookie", montarCookie("oauth_state", "", 0));
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origem = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = lerCookie(request, "oauth_state");

  if (url.searchParams.get("error")) return voltarComErro(origem, "cancelado");
  if (!code || !state || !stateCookie || state !== stateCookie) return voltarComErro(origem, "state_invalido");
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return voltarComErro(origem, "nao_configurado");

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origem}/api/auth/discord/callback`,
      }),
    });
    if (!tokenRes.ok) return voltarComErro(origem, "troca_de_token");
    const { access_token } = await tokenRes.json();

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) return voltarComErro(origem, "perfil_discord");
    const perfil = await userRes.json();

    const userId = String(perfil.id);
    const username = String(perfil.global_name || perfil.username).slice(0, 80);
    const avatar = perfil.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${perfil.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) >> 22n) % 6}.png`;

    await env.DB.prepare(
      `INSERT INTO discord_users (user_id, username, avatar, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP`
    ).bind(userId, username, avatar).run();

    const headers = new Headers({ Location: `${origem}/` });
    headers.append("Set-Cookie", await criarSessao(env, userId));
    headers.append("Set-Cookie", montarCookie("oauth_state", "", 0));
    return new Response(null, { status: 302, headers });
  } catch {
    return voltarComErro(origem, "falha_inesperada");
  }
}
