// Utilitários compartilhados pelas Pages Functions.
const COOKIE_SESSAO = '__Host-session';
const SESSAO_SEGUNDOS = 60 * 60 * 24 * 7;
const enc = new TextEncoder();

export function json(dados, status = 200, extra = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}
export const falha = (status, mensagem) => json({ erro: mensagem }, status);

export function base64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function tokenAleatorio(bytes = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}
export async function sha256(texto) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(texto)));
}
export async function sha256Hex(texto) {
  return [...(await sha256(texto))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function lerCookies(request) {
  const out = {};
  for (const par of (request.headers.get('cookie') || '').split(';')) {
    const i = par.indexOf('=');
    if (i > 0) out[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  }
  return out;
}
export function montarCookie(nome, valor, maxAge) {
  return `${nome}=${encodeURIComponent(valor)}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function urlAvatar(id, hash) {
  if (hash) {
    const ext = hash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${id}/${hash}.${ext}?size=64`;
  }
  const idx = Number((BigInt(id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

export async function criarSessao(env, userId) {
  const token = tokenAleatorio(32);
  const agora = Math.floor(Date.now() / 1000);
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(await sha256Hex(token), userId, agora, agora + SESSAO_SEGUNDOS)
    .run();
  return { token, maxAge: SESSAO_SEGUNDOS };
}
export const cookieSessao = (token, maxAge) => montarCookie(COOKIE_SESSAO, token, maxAge);
export const cookieSessaoLimpo = () => montarCookie(COOKIE_SESSAO, '', 0);

// Lê a sessão do cookie e devolve o usuário (ou null). A identidade vem SEMPRE daqui, nunca do corpo da requisição.
export async function usuarioDaSessao(request, env) {
  const token = lerCookies(request)[COOKIE_SESSAO];
  if (!token) return null;
  const agora = Math.floor(Date.now() / 1000);
  const u = await env.DB.prepare(
    `SELECT u.id, u.username, u.global_name, u.avatar FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?1 AND s.expires_at > ?2`,
  ).bind(await sha256Hex(token), agora).first();
  if (!u) return null;
  return { id: u.id, nome: u.global_name || u.username, username: u.username, avatar: urlAvatar(u.id, u.avatar) };
}

// Proteção CSRF para métodos que alteram dados: exige Origin igual ao do site e corpo JSON.
export function verificarOrigem(request) {
  const origem = request.headers.get('origin');
  if (!origem || origem !== new URL(request.url).origin) return falha(403, 'Origem não permitida.');
  return null;
}
export async function lerJson(request) {
  const tipo = request.headers.get('content-type') || '';
  if (!tipo.includes('application/json')) return { erro: falha(415, 'Envie o corpo como application/json.') };
  try {
    return { corpo: await request.json() };
  } catch {
    return { erro: falha(400, 'JSON inválido.') };
  }
}

// Envolve um handler que exige login (e origem válida em métodos de escrita).
export function protegido(handler) {
  return async (ctx) => {
    const { request, env } = ctx;
    if (!['GET', 'HEAD'].includes(request.method)) {
      const e = verificarOrigem(request);
      if (e) return e;
    }
    const usuario = await usuarioDaSessao(request, env);
    if (!usuario) return falha(401, 'Faça login com o Discord para continuar.');
    try {
      return await handler({ ...ctx, usuario });
    } catch (err) {
      console.error(err);
      return falha(500, 'Erro interno. Tente novamente.');
    }
  };
}
