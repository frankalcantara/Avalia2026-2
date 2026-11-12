export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const code = url.searchParams.get('code');

    if (!code) {
        return new Response('Código de autorização ausente.', { status: 400 });
    }

    const clientId = context.env.DISCORD_CLIENT_ID;
    const clientSecret = context.env.DISCORD_CLIENT_SECRET;
    
    // Atualizado com o caminho /api/
    const redirectUri = 'http://localhost:8788/api/auth/callback';

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri
        })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
        return new Response('Erro ao autenticar com o Discord.', { status: 400 });
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const userData = await userResponse.json();

    const userInfo = JSON.stringify({
        id: userData.id,
        name: userData.global_name || userData.username,
        avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null
    });

    const cookieValue = btoa(encodeURIComponent(userInfo));

    return new Response(null, {
        status: 302,
        headers: {
            'Location': '/',
            'Set-Cookie': `user_session=${cookieValue}; Path=/; Max-Age=86400; SameSite=Lax`
        }
    });
}