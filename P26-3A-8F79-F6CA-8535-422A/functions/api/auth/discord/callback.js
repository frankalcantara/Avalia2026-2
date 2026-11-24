import { clearCookie, getCookie, sessionCookie } from "../../../_lib.js";

const fail = (code) => {
  const headers = new Headers({ Location: `/?auth_error=${code}` });
  headers.append("Set-Cookie", clearCookie("oauth_state", "/api/auth"));
  return new Response(null, { status: 302, headers });
};

function avatarUrl(u) {
  if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`;
  // avatar padrão: nomes novos usam (id >> 22) % 6; contas com discriminator antigo usam discriminator % 5
  const index = u.discriminator && u.discriminator !== "0"
    ? Number(u.discriminator) % 5
    : Number((BigInt(u.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

// GET /api/auth/discord/callback → troca o code, faz upsert do usuário e grava o cookie de sessão.
export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) return fail("not_configured");

  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  if (!state || state !== getCookie(request, "oauth_state")) return fail("invalid_state");
  if (url.searchParams.get("error")) return fail("access_denied");
  const code = url.searchParams.get("code");
  if (!code) return fail("missing_code");

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: new URL("/api/auth/discord/callback", request.url).href,
      }),
    });
    if (!tokenRes.ok) return fail("token_exchange_failed");
    const { access_token } = await tokenRes.json();

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) return fail("fetch_user_failed");
    const u = await userRes.json();
    if (!/^\d+$/.test(u.id || "")) return fail("fetch_user_failed");

    await env.DB.prepare(
      `INSERT INTO users (user_id, username, avatar) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`
    ).bind(u.id, u.global_name || u.username, avatarUrl(u)).run();

    const headers = new Headers({ Location: "/" });
    headers.append("Set-Cookie", clearCookie("oauth_state", "/api/auth"));
    headers.append("Set-Cookie", await sessionCookie(env, u.id));
    return new Response(null, { status: 302, headers });
  } catch (err) {
    console.error(err);
    return fail("server_error");
  }
}

export { methodNotAllowed as onRequest } from "../../../_lib.js";
