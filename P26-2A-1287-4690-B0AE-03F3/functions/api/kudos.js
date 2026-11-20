import { json, error, readJson } from '../_lib/http.js';
import { getBadge } from '../_lib/badges.js';
import { getSessionUser } from '../_lib/session.js';

const SELECT = `
  SELECT k.id, k.badge, k.message, k.created_at,
         f.id AS from_id, f.username AS from_username, f.avatar AS from_avatar,
         t.id AS to_id, t.username AS to_username, t.avatar AS to_avatar
    FROM kudos k
    JOIN users f ON f.id = k.from_user_id
    JOIN users t ON t.id = k.to_user_id`;

function format(r) {
  const b = getBadge(r.badge);
  return {
    id: r.id,
    badge: r.badge,
    badge_label: b ? b.label : r.badge,
    badge_emoji: b ? b.emoji : '',
    message: r.message,
    created_at: r.created_at,
    from: { id: r.from_id, username: r.from_username, avatar: r.from_avatar },
    to: { id: r.to_id, username: r.to_username, avatar: r.to_avatar },
  };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const filter = url.searchParams.get('filter') || 'all';
  if (!['all', 'received', 'sent'].includes(filter)) return error('filter inválido', 400);
  const user = url.searchParams.get('user');
  if (filter !== 'all' && !user) return error('user é obrigatório', 400);

  let limit = 50;
  if (url.searchParams.has('limit')) {
    limit = Number(url.searchParams.get('limit'));
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return error('limit inválido (1–100)', 400);
  }
  let before = null;
  if (url.searchParams.has('before')) {
    before = Number(url.searchParams.get('before'));
    if (!Number.isInteger(before)) return error('before inválido', 400);
  }

  const where = [];
  const binds = [];
  if (filter === 'received') { where.push('k.to_user_id = ?'); binds.push(user); }
  if (filter === 'sent') { where.push('k.from_user_id = ?'); binds.push(user); }
  if (before !== null) { where.push('k.id < ?'); binds.push(before); }

  const sql = `${SELECT}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY k.id DESC LIMIT ?`;
  binds.push(limit);
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return json({ kudos: (results || []).map(format) });
}

export async function onRequestPost({ request, env }) {
  const me = await getSessionUser(request, env);
  if (!me) return error('Não autenticado', 401);

  const body = await readJson(request);
  if (!body) return error('JSON inválido', 400);
  const { to_user_id, badge, message } = body;
  if (typeof to_user_id !== 'string' || typeof badge !== 'string' || typeof message !== 'string' || !to_user_id || !badge) {
    return error('Campos obrigatórios: to_user_id, badge, message', 400);
  }
  if (!getBadge(badge)) return error('Selo inválido', 400);
  const text = message.trim();
  if (!text) return error('Mensagem vazia', 400);
  if ([...text].length > 280) return error('Mensagem excede 280 caracteres', 400);
  if (to_user_id === me.id) return error('Você não pode enviar um elogio a si mesmo', 400);

  const dest = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(to_user_id).first();
  if (!dest) return error('Destinatário não encontrado', 404);

  const created = new Date().toISOString();
  const res = await env.DB.prepare(
    'INSERT INTO kudos (from_user_id, to_user_id, badge, message, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(me.id, to_user_id, badge, text, created)
    .run();
  let id = res && res.meta && res.meta.last_row_id;
  if (id == null) {
    const last = await env.DB.prepare('SELECT MAX(id) AS id FROM kudos WHERE from_user_id = ?').bind(me.id).first();
    id = last && last.id;
  }
  const row = await env.DB.prepare(`${SELECT} WHERE k.id = ?`).bind(id).first();
  return json({ kudo: format(row) }, 201);
}
