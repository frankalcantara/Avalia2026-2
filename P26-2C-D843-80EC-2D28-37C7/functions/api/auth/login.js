export async function onRequestGet(context) {
    const clientId = context.env.DISCORD_CLIENT_ID;
    
    
    const redirectUri = encodeURIComponent('http://localhost:8788/api/auth/callback');
    
    const discordLoginUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
    
    return Response.redirect(discordLoginUrl, 302);
}