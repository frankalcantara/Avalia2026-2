import { lerCookie, redirecionar } from "../../_lib/http.js";
import { cookieSessao, criarSessao } from "../../_lib/sessao.js";

const LIMPAR_STATE = "oauth_state=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
const USER_AGENT = "QuadroDeCaronas (Cloudflare Pages, 1.0)";

function urlDoAvatar(perfil) {
  if (perfil.avatar) {
    const extensao = perfil.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${perfil.id}/${perfil.avatar}.${extensao}?size=128`;
  }
  const indice = Number((BigInt(perfil.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${indice}.png`;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const falhar = (codigo) => redirecionar(`/?erro=${codigo}`, [LIMPAR_STATE]);

  if (!env.DB || !env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return falhar("config");
  if (url.searchParams.get("error")) return falhar("login_cancelado");

  const codigo = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const salvo = lerCookie(request, "oauth_state");
  if (!codigo || !state || !salvo || state !== salvo) return falhar("estado_invalido");

  const resposta = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID.trim(),
      client_secret: env.DISCORD_CLIENT_SECRET.trim(),
      grant_type: "authorization_code",
      code: codigo,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });
  if (!resposta.ok) return falhar("troca_token");
  const { access_token: accessToken } = await resposta.json();
  if (!accessToken) return falhar("troca_token");

  const respostaPerfil = await fetch("https://discord.com/api/users/@me", {
    headers: { authorization: `Bearer ${accessToken}`, "user-agent": USER_AGENT },
  });
  if (!respostaPerfil.ok) return falhar("perfil");
  const perfil = await respostaPerfil.json();
  if (!perfil?.id || !perfil?.username) return falhar("perfil");

  const agora = Math.floor(Date.now() / 1000);
  await env.DB
    .prepare(
      `INSERT INTO usuarios (id, username, nome, avatar_url, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username = excluded.username,
         nome = excluded.nome,
         avatar_url = excluded.avatar_url,
         atualizado_em = excluded.atualizado_em`
    )
    .bind(perfil.id, perfil.username, perfil.global_name || perfil.username, urlDoAvatar(perfil), agora, agora)
    .run();

  await env.DB.prepare("DELETE FROM sessoes WHERE expira_em < ?").bind(agora).run();
  const token = await criarSessao(env.DB, perfil.id);
  return redirecionar("/", [LIMPAR_STATE, cookieSessao(token)]);
}
