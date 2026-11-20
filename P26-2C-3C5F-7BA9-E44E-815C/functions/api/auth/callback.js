import { getCookie, cookie, randomToken, sha256 } from "../../../lib/util.js";

const text = (msg, status) => new Response(msg, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== getCookie(request, "oauth_state")) {
    return text("Não foi possível validar o login. Volte e clique em Entrar com Discord de novo.", 400);
  }

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });
  if (!tokenRes.ok) return text("O Discord recusou o login. Tente de novo.", 502);
  const { access_token } = await tokenRes.json();

  const meRes = await fetch("https://discord.com/api/users/@me", { headers: { authorization: `Bearer ${access_token}` } });
  if (!meRes.ok) return text("Não foi possível ler seu perfil no Discord.", 502);
  const me = await meRes.json();

  await env.DB.prepare(
    "INSERT INTO users (id, username, avatar) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET username = ?2, avatar = ?3"
  ).bind(me.id, me.global_name || me.username, me.avatar ?? null).run();

  const sid = randomToken();
  const maxAge = 7 * 24 * 3600;
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(sid), me.id, Date.now() + maxAge * 1000).run();

  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", cookie("sid", sid, maxAge));
  headers.append("Set-Cookie", cookie("oauth_state", "", 0));
  return new Response(null, { status: 302, headers });
}
