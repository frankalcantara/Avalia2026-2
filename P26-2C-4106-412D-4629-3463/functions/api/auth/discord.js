// Inicia o login: gera state + PKCE (S256), guarda em cookies curtos e redireciona ao Discord.
import { tokenAleatorio, sha256, base64url, montarCookie } from '../../_lib/util.js';

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID) return new Response('DISCORD_CLIENT_ID não configurado.', { status: 500 });
  const origem = new URL(request.url).origin;
  const state = tokenAleatorio(24);
  const verifier = tokenAleatorio(48);
  const challenge = base64url(await sha256(verifier));

  const destino = new URL('https://discord.com/oauth2/authorize');
  destino.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: `${origem}/api/auth/discord/callback`,
    scope: 'identify',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();

  const h = new Headers({ location: destino.toString(), 'cache-control': 'no-store' });
  h.append('set-cookie', montarCookie('__Host-oauth_state', state, 600));
  h.append('set-cookie', montarCookie('__Host-oauth_verifier', verifier, 600));
  return new Response(null, { status: 302, headers: h });
}
