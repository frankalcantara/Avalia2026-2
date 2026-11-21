// Conclui o login: valida state, troca o code por token, lê o perfil (user_id, nome, avatar) e cria a sessão.
import { lerCookies, montarCookie, criarSessao, cookieSessao } from '../../../_lib/util.js';

function voltar(erro, cookies = []) {
  const h = new Headers({ location: erro ? `/?erro=${erro}` : '/', 'cache-control': 'no-store' });
  for (const c of cookies) h.append('set-cookie', c);
  return new Response(null, { status: 302, headers: h });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const limpar = [montarCookie('__Host-oauth_state', '', 0), montarCookie('__Host-oauth_verifier', '', 0)];
  if (url.searchParams.get('error')) return voltar('negado', limpar);

  const cookies = lerCookies(request);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const verifier = cookies['__Host-oauth_verifier'];
  if (!state || !code || !verifier || state !== cookies['__Host-oauth_state']) return voltar('estado', limpar);

  try {
    const troca = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${url.origin}/api/auth/discord/callback`,
        code_verifier: verifier,
      }),
    });
    if (!troca.ok) return voltar('token', limpar);
    const { access_token } = await troca.json();

    const perfilRes = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `Bearer ${access_token}` },
    });
    if (!perfilRes.ok) return voltar('perfil', limpar);
    const p = await perfilRes.json();
    if (!p.id || !p.username) return voltar('perfil', limpar);

    const agora = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO users (id, username, global_name, avatar, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5)
       ON CONFLICT(id) DO UPDATE SET username = ?2, global_name = ?3, avatar = ?4, updated_at = ?5`,
    ).bind(String(p.id), p.username, p.global_name ?? null, p.avatar ?? null, agora).run();

    const { token, maxAge } = await criarSessao(env, String(p.id));
    return voltar(null, [...limpar, cookieSessao(token, maxAge)]);
  } catch (err) {
    console.error(err);
    return voltar('interno', limpar);
  }
}
