export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // Variáveis com valores de reserva (fallback)
  const clientId = env.DISCORD_CLIENT_ID || "1569713280623181918";
  const clientSecret = env.DISCORD_CLIENT_SECRET;
  const redirectUri = env.DISCORD_REDIRECT_URI || "https://p26-2b-5505-d65c-d22d-30ed.pages.dev/api/auth/discord";

  // PASSO 1: Redirecionar para o login do Discord
  if (!code) {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify`;
    return Response.redirect(discordAuthUrl, 302);
  }

  // PASSO 2: Trocar código por token de acesso
  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    });
    
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) return new Response("Falha na autorização do Discord", { status: 400 });

    // PASSO 3: Buscar perfil do usuário
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();

    // PASSO 4: Registrar ou atualizar no banco D1
    const userId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO users (id, discord_id, username, avatar) 
      VALUES (?, ?, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET 
        username = excluded.username, 
        avatar = excluded.avatar
    `).bind(userId, userData.id, userData.username, userData.avatar).run();

    // PASSO 5: Definir cookie de sessão e retornar para a home
    const cookie = `session=${userData.id}; HttpOnly; Secure; Path=/; SameSite=Lax`;
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/",
        "Set-Cookie": cookie
      }
    });

  } catch (error) {
    return new Response("Erro interno no servidor: " + error.message, { status: 500 });
  }
}