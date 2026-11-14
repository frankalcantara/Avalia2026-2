/**
 * /api/auth/discord/callback — troca o code pelo token, lê o perfil (@me),
 * grava o usuário no D1 (discord_users) e abre uma sessão em cookie ASSINADO (HMAC).
 */
import { assinar, lerCookie } from "../../../../lib/util.js";

const voltar = (url, motivo) =>
  Response.redirect(new URL("/?auth_error=" + encodeURIComponent(motivo), url.origin).href, 302);

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (url.searchParams.get("error") || !code) return voltar(url, url.searchParams.get("error") || "sem_codigo");
  if (!state || state !== lerCookie(request, "oauth_state")) return voltar(url, "estado_invalido");
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET)
    return Response.json({ ok: false, erro: "Faltam DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET ou SESSION_SECRET." }, { status: 500 });

  try {
    const tk = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${url.origin}/api/auth/discord/callback`,
      }),
    });
    if (!tk.ok) return voltar(url, "troca_de_token_falhou");
    const { access_token } = await tk.json();

    const me = await fetch("https://discord.com/api/users/@me", { headers: { authorization: `Bearer ${access_token}` } });
    if (!me.ok) return voltar(url, "perfil_indisponivel");
    const d = await me.json();

    // Sem avatar personalizado, o Discord usa um dos 6 avatares padrão.
    const avatar = d.avatar
      ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png?size=64`
      : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(d.id) >> 22n) % 6n)}.png`;

    await env.DB.prepare(
      `INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP`
    ).bind(d.id, d.global_name || d.username, avatar).run();

    const token = await assinar({ uid: d.id, exp: Math.floor(Date.now() / 1000) + 7 * 86400 }, env.SESSION_SECRET);
    const h = new Headers({ Location: "/" });
    h.append("Set-Cookie", `sessao=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
    h.append("Set-Cookie", "oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0");
    return new Response(null, { status: 302, headers: h });
  } catch {
    return voltar(url, "erro_inesperado");
  }
}
