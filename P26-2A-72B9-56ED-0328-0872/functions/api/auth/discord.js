export async function onRequestGet(context) {
    // Vai buscar o ID do Cliente de forma segura ao nosso ambiente (.dev.vars ou Cloudflare)
    const clientId = context.env.DISCORD_CLIENT_ID;
    
    // Constrói dinamicamente a URL de retorno com base onde o código está a correr (local ou nuvem)
    const url = new URL(context.request.url);
    const redirectUri = encodeURIComponent(`${url.origin}/api/auth/discord/callback`);
    
    // Cria o link oficial de autorização do Discord solicitando acesso à identidade (scope=identify)
    const discordUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
    
    // Redireciona imediatamente o utilizador para o ecrã de login do Discord
    return Response.redirect(discordUrl, 302);
}