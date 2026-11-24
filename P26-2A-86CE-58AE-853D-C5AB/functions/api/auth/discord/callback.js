function clearStateCookie(response) {
  response.headers.append(
    "Set-Cookie",
    "oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  );
  return response;
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const prefix = `${name}=`;
  const item = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? item.slice(prefix.length) : null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const stateCookie = getCookie(request, "oauth_state");

  if (!state || !stateCookie || state !== stateCookie) {
    return clearStateCookie(Response.json({ error: "OAuth state inválido." }, { status: 400 }));
  }

  const code = url.searchParams.get("code");
  if (url.searchParams.has("error") || !code) {
    return clearStateCookie(Response.json({ error: "Autorização Discord recusada ou incompleta." }, { status: 400 }));
  }

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DB) {
    return clearStateCookie(Response.json({ error: "Autenticação Discord não configurada." }, { status: 500 }));
  }

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
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

    if (!tokenResponse.ok) {
      return clearStateCookie(Response.json({ error: "Falha na troca do código OAuth2." }, { status: 502 }));
    }

    const tokenData = await tokenResponse.json();
    if (typeof tokenData.access_token !== "string" || !tokenData.access_token) {
      return clearStateCookie(Response.json({ error: "Resposta OAuth2 inválida." }, { status: 502 }));
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      return clearStateCookie(Response.json({ error: "Falha ao obter o perfil Discord." }, { status: 502 }));
    }

    const discordUser = await userResponse.json();
    const userId = discordUser.id;
    const username = discordUser.global_name || discordUser.username;
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    if (typeof userId !== "string" || typeof username !== "string" || !username) {
      return clearStateCookie(Response.json({ error: "Perfil Discord inválido." }, { status: 502 }));
    }

    await env.DB.prepare(
      "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
    ).bind(userId, username, avatar).run();

    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(
      "INSERT INTO sessoes (token, user_id, expira_em) VALUES (?, ?, ?)"
    ).bind(sessionToken, userId, expiresAt).run();

    const response = new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": `sessao=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
      },
    });
    response.headers.append(
      "Set-Cookie",
      "oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    );
    response.headers.append(
      "Set-Cookie",
      "discord_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    );
    return response;
  } catch (error) {
    console.error("Discord OAuth callback failed.");
    return clearStateCookie(Response.json({ error: "Falha ao concluir a autenticação Discord." }, { status: 502 }));
  }
}
