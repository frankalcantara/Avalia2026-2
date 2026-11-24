import { exchangeCode, fetchDiscordUser } from '../../../../lib/discord.js';
import { redirect } from '../../../../lib/http.js';
import {
  createSession,
  parseCookies,
  serializeCookie,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  STATE_COOKIE,
} from '../../../../lib/session.js';

// GET /api/auth/discord/callback — conclui o OAuth2: valida o state, troca o code, importa
// user_id / nome / avatar do Discord, grava no D1 e abre a sessão.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:';
  const clearState = serializeCookie(STATE_COOKIE, '', { maxAge: 0, secure });
  const back = (code) => redirect(`/?erro=${code}`, [clearState]);

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) return back('config');
  if (url.searchParams.get('error')) return back('login_cancelado');

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = parseCookies(request.headers.get('Cookie'))[STATE_COOKIE];
  if (!code || !state || !expected || state !== expected) return back('state_invalido');

  try {
    const accessToken = await exchangeCode({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      code,
      redirectUri: `${url.origin}/api/auth/discord/callback`,
    });
    const user = await fetchDiscordUser(accessToken);

    await env.DB.prepare(
      `INSERT INTO users (id, username, display_name, avatar) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username = excluded.username,
         display_name = excluded.display_name,
         avatar = excluded.avatar,
         updated_at = datetime('now')`,
    )
      .bind(user.id, user.username, user.displayName, user.avatar)
      .run();

    const token = await createSession(env.SESSION_SECRET, user.id);
    return redirect('/', [
      serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS, secure }),
      clearState,
    ]);
  } catch {
    return back('falha_discord');
  }
}
