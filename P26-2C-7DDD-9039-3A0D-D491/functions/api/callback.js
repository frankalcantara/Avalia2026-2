import {
  clearCookie,
  createSignedToken,
  getCookie,
  getStateCookieName,
  hasDatabase,
  hasOAuthConfiguration,
  jsonResponse,
  methodNotAllowed,
  sessionCookie
} from '../_utils.js';

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return methodNotAllowed('GET');
  }
  if (!hasOAuthConfiguration(context.env) || !hasDatabase(context.env)) {
    return jsonResponse({ error: 'O login requer credenciais Discord e o banco D1 configurados.' }, 503);
  }

  var url = new URL(context.request.url);
  var code = url.searchParams.get('code');
  var returnedState = url.searchParams.get('state');
  var savedState = getCookie(context.request, getStateCookieName());
  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return new Response('Não foi possível validar o retorno do Discord. Tente entrar novamente.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Set-Cookie': clearCookie(getStateCookieName()) }
    });
  }

  var redirectUri = new URL('/api/callback', url.origin).toString();
  var tokenResponse;
  try {
    tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: context.env.DISCORD_CLIENT_ID,
        client_secret: context.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });
  } catch (error) {
    console.error('Falha ao contatar o endpoint de token do Discord:', error);
    return jsonResponse({ error: 'Não foi possível contatar o Discord para concluir o login.' }, 502);
  }

  if (!tokenResponse.ok) {
    console.error('Discord recusou a troca do código OAuth. Status:', tokenResponse.status);
    return jsonResponse({ error: 'O Discord recusou o código de login. Tente entrar novamente.' }, 401);
  }

  var tokenData;
  try {
    tokenData = await tokenResponse.json();
  } catch (error) {
    console.error('Resposta inválida do endpoint de token do Discord:', error);
    return jsonResponse({ error: 'O Discord retornou uma resposta de login inválida.' }, 502);
  }
  if (!tokenData.access_token) {
    return jsonResponse({ error: 'O Discord não retornou um token de acesso.' }, 502);
  }

  var userResponse;
  try {
    userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
    });
  } catch (error) {
    console.error('Falha ao consultar o perfil no Discord:', error);
    return jsonResponse({ error: 'Não foi possível consultar seu perfil no Discord.' }, 502);
  }
  if (!userResponse.ok) {
    console.error('Discord recusou a consulta do perfil. Status:', userResponse.status);
    return jsonResponse({ error: 'Não foi possível validar o perfil no Discord.' }, 502);
  }

  var user;
  try {
    user = await userResponse.json();
  } catch (error) {
    console.error('Resposta inválida do perfil do Discord:', error);
    return jsonResponse({ error: 'O Discord retornou um perfil inválido.' }, 502);
  }
  if (!user.id || !user.username) {
    return jsonResponse({ error: 'O perfil do Discord não contém os dados necessários.' }, 502);
  }

  var avatar = user.avatar
    ? 'https://cdn.discordapp.com/avatars/' + encodeURIComponent(user.id) + '/' + encodeURIComponent(user.avatar) + '.png'
    : 'https://cdn.discordapp.com/embed/avatars/' + (Number(user.discriminator || 0) % 5) + '.png';

  try {
    await context.env.DB.prepare(
      'INSERT INTO users (id, username, avatar) VALUES (?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar'
    ).bind(user.id, user.username, avatar).run();
    var signedSession = await createSignedToken({
      user_id: user.id,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7
    }, context.env);
    var response = new Response(null, {
      status: 302,
      headers: { 'Location': new URL('/', url.origin).toString(), 'Cache-Control': 'no-store' }
    });
    response.headers.append('Set-Cookie', clearCookie(getStateCookieName()));
    response.headers.append('Set-Cookie', sessionCookie(signedSession));
    return response;
  } catch (error) {
    console.error('Falha ao salvar usuário ou criar sessão:', error);
    return jsonResponse({ error: 'Não foi possível salvar o perfil ou criar a sessão.' }, 500);
  }
}
