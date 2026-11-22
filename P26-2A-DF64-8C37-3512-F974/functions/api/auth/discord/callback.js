// GET /api/auth/discord/callback — troca o código por token, importa user_id,
// nome de usuário e avatar do Discord, grava no D1 e cria a sessão.
import { nowIso, parseCookies, redirect, serializeCookie } from '../../../_lib/http.js';
import { createSession, safeEqual } from '../../../_lib/session.js';
import { DEFAULT_TZ, todayIn } from '../../../_lib/dates.js';
import { redirectUri } from '../../../_lib/decks.js';

const DISCORD_API = 'https://discord.com/api/v10';
const clearState = serializeCookie('oauth_state', '', { maxAge: 0, path: '/api/auth' });

const SAMPLE_DECK = {
  name: 'Exemplo · Capitais do mundo',
  description: 'Baralho de demonstração criado no seu primeiro login. Pode editar ou excluir.',
  cards: [
    ['Capital da Austrália', 'Camberra'],
    ['Capital do Canadá', 'Ottawa'],
    ['Capital do Japão', 'Tóquio'],
    ['Capital da Turquia', 'Ancara'],
    ['Capital do Marrocos', 'Rabat'],
    ['Capital da Nova Zelândia', 'Wellington'],
  ],
};

function fail(reason) {
  return redirect(`/?login=${encodeURIComponent(reason)}`, [clearState]);
}

async function discordFetch(url, init) {
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      console.error('Discord respondeu', res.status, url, await res.text().catch(() => ''));
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('Falha de rede com o Discord', url, err);
    return null;
  }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('error')) return fail('cancelado');

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = parseCookies(request).oauth_state;
  if (!code || !state || !expected || !safeEqual(state, expected)) return fail('estado_invalido');

  // 1. Código de autorização -> access token
  const token = await discordFetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(request, env),
    }),
  });
  if (!token || !token.access_token) return fail('token');

  // 2. Dados do usuário (escopo identify): id, username, global_name, avatar
  const me = await discordFetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!me || !/^\d{5,25}$/.test(String(me.id || ''))) return fail('perfil');

  const db = env.DB;
  const now = nowIso();

  // 3. Upsert do estudante. created_at só é igual a "now" quando a linha acabou de ser criada,
  //    o que torna a detecção de primeiro login segura mesmo com callbacks simultâneos.
  const row = await db
    .prepare(
      `INSERT INTO users (id, username, global_name, avatar, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username = excluded.username,
         global_name = excluded.global_name,
         avatar = excluded.avatar,
         last_login_at = excluded.last_login_at
       RETURNING created_at`
    )
    .bind(
      me.id,
      String(me.username || 'estudante').slice(0, 64),
      me.global_name ? String(me.global_name).slice(0, 64) : null,
      me.avatar && /^(a_)?[0-9a-f]{32}$/.test(me.avatar) ? me.avatar : null,
      now,
      now
    )
    .first();

  // 4. Primeiro login: baralho de exemplo, criado numa única transação.
  if (row && row.created_at === now) {
    const today = todayIn(DEFAULT_TZ);
    await db.batch([
      db
        .prepare('INSERT INTO decks (user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .bind(me.id, SAMPLE_DECK.name, SAMPLE_DECK.description, now, now),
      ...SAMPLE_DECK.cards.map(([front, back]) =>
        db
          .prepare(
            `INSERT INTO cards (deck_id, user_id, front, back, due_date, created_at, updated_at)
             VALUES ((SELECT MAX(id) FROM decks WHERE user_id = ?), ?, ?, ?, ?, ?, ?)`
          )
          .bind(me.id, me.id, front, back, today, now, now)
      ),
    ]);
  }

  // 5. Sessão no servidor + cookie HttpOnly
  const sessionCookie = await createSession(db, me.id);
  return redirect('/', [sessionCookie, clearState]);
}
