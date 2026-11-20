import { redirect } from '../../_lib/http.js';
import { createSession } from '../../_lib/session.js';
import { exchangeCode, fetchDiscordUser, avatarUrl } from '../../_lib/discord.js';

const FAIL = '/?erro=login';

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) return redirect(FAIL);

    // Consome o state (uso único): DELETE ... RETURNING quando disponível, senão select+delete.
    const now = Math.floor(Date.now() / 1000);
    const row = await env.DB.prepare('SELECT expires_at FROM oauth_states WHERE state = ?').bind(state).first();
    await env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();
    if (!row || row.expires_at <= now) return redirect(FAIL);

    const redirectUri = `${url.origin}/api/auth/callback`;
    const accessToken = await exchangeCode(env, code, redirectUri);
    const du = await fetchDiscordUser(accessToken);

    const id = String(du.id);
    const username = du.global_name || du.username || id;
    await env.DB.prepare(
      `INSERT INTO users (id, username, avatar, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar`
    )
      .bind(id, username, avatarUrl(du), new Date().toISOString())
      .run();

    const cookie = await createSession(env, request, id);
    return redirect('/', 302, [['Set-Cookie', cookie]]);
  } catch (e) {
    return redirect(FAIL);
  }
}
