import { verifyOAuthState, createSession } from "../../_lib/auth.js";
import { cookie, clearCookie, isSecure, json, setCookie } from "../../_lib/http.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const raw = cookie(request, "ct_oauth");
  if (!code || !returnedState || !raw) return json({ error: "Retorno OAuth inválido." }, 400);

  let stored;
  try { stored = JSON.parse(atob(raw)); } catch { return json({ error: "Estado OAuth inválido." }, 400); }
  const stateData = await verifyOAuthState(stored.signed, env);
  if (!stateData || stateData.state !== returnedState || stored.state !== returnedState) {
    return json({ error: "Falha na validação do estado OAuth." }, 400);
  }

  const redirectUri = new URL("/api/auth/discord/callback", request.url).toString();
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    })
  });
  if (!tokenResponse.ok) return json({ error: "Não foi possível concluir o login Discord." }, 502);
  const token = await tokenResponse.json();

  const profileResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  if (!profileResponse.ok) return json({ error: "Não foi possível obter o perfil Discord." }, 502);
  const profile = await profileResponse.json();
  const avatar = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=128`
    : null;
  const globalName = profile.global_name || profile.username;

  await env.DB.prepare(`
    INSERT INTO users (id, username, global_name, avatar)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      global_name = excluded.global_name,
      avatar = excluded.avatar,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).bind(profile.id, profile.username, globalName, avatar).run();

  const session = await createSession({ id: profile.id }, env);
  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", setCookie("ct_session", session, 60 * 60 * 24 * 7, isSecure(request)));
  headers.append("Set-Cookie", clearCookie("ct_oauth", isSecure(request)));
  return new Response(null, { status: 302, headers });
}
