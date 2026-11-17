#!/usr/bin/env node
// Suíte e2e do Projeto #24 (P26-2C-BF60-C440-6484-80FA) — Node puro, fetch nativo, zero dependências.
// Uso:  node tests/e2e.mjs http://localhost:8788
// Cria as próprias fixtures (usuários + sessões) no D1 LOCAL via `npx wrangler d1 execute DB --local`,
// com ids/tokens aleatórios por execução: pode ser rodada várias vezes sem limpar o banco.
// Saída: uma linha PASS/FAIL/SKIP por caso; código de saída 1 se algum caso falhar.
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const BASE = (process.argv[2] || 'http://localhost:8788').replace(/\/+$/, '');
const ORIGIN = new URL(BASE).origin;
const PROJECT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHAVE = 'P26-2C-BF60-C440-6484-80FA';

// ---------------------------------------------------------------- relatório
let nPass = 0, nFail = 0, nSkip = 0;
const failures = [];
let G = '';
function group(id, title) { G = id; console.log(`\n=== ${id} ${title}`); }
function check(name, cond, detail) {
  if (cond) { nPass++; console.log(`PASS [${G}] ${name}`); }
  else {
    nFail++;
    const d = detail === undefined ? '' : ` :: ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400)}`;
    failures.push(`[${G}] ${name}${d}`);
    console.log(`FAIL [${G}] ${name}${d}`);
  }
  return !!cond;
}
function skip(name, why) { nSkip++; console.log(`SKIP [${G}] ${name} — ${why}`); }

// ---------------------------------------------------------------- HTTP
// Envia Origin do próprio site em escritas (como um navegador same-origin faria).
async function call(method, path, opts = {}) {
  const { token, body, raw, ct, origin = ORIGIN, cookie, headers = {}, redirect = 'manual' } = opts;
  const h = { ...headers };
  if (origin && method !== 'GET' && method !== 'HEAD') h.Origin = origin;
  const cookies = [];
  if (token) cookies.push(`session=${token}`);
  if (cookie) cookies.push(cookie);
  if (cookies.length) h.Cookie = cookies.join('; ');
  let payload;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    h['Content-Type'] = ct === undefined ? 'application/json' : ct;
    if (ct === null) { delete h['Content-Type']; payload = Buffer.from(payload); }
  } else if (raw !== undefined) {
    // Buffer não recebe Content-Type automático do fetch; string recebe text/plain.
    payload = Buffer.from(raw, 'utf8');
    if (ct) h['Content-Type'] = ct;
  }
  const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* não-JSON */ }
  return { status: res.status, headers: res.headers, text, json, setCookies: res.headers.getSetCookie?.() || [] };
}
const errIs = (r, status, code) => r.status === status && (!code || (r.json && r.json.error === code));
const show = (r) => `${r.status} ${r.text.slice(0, 200)}`;

// ---------------------------------------------------------------- datas UTC
const now = new Date();
const ymd = (days) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days)).toISOString().slice(0, 10);

// ---------------------------------------------------------------- fixtures
const RUN = randomBytes(4).toString('hex');
const hex64 = () => randomBytes(32).toString('hex');
function snowflake() {
  const digits = [...randomBytes(18)].map((b) => String(b % 10)).join('');
  return '7' + digits.slice(0, 17);
}
const USER_KEYS = ['A', 'B', 'C', 'S', 'T', 'D', 'P', 'E', 'L', 'X', 'Q', 'M', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6'];
const U = {};
for (const k of USER_KEYS) U[k] = { key: k, id: snowflake(), token: hex64(), username: `e2e_${RUN}_${k.toLowerCase()}` };
const L_TOKEN2 = hex64();      // segunda sessão do usuário L (sobrevive ao logout da primeira)
const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;

function setupFixtures() {
  const lines = [];
  for (const u of Object.values(U)) {
    lines.push(`INSERT INTO users (user_id, username, display_name, avatar_url) VALUES (${sqlStr(u.id)}, ${sqlStr(u.username)}, ${sqlStr('E2E ' + u.key)}, 'https://cdn.discordapp.com/embed/avatars/0.png');`);
    const exp = u.key === 'X' ? "datetime('now', '-1 hour')" : "datetime('now', '+1 day')";
    lines.push(`INSERT INTO sessions (token, user_id, expires_at) VALUES (${sqlStr(u.token)}, ${sqlStr(u.id)}, ${exp});`);
  }
  lines.push(`INSERT INTO sessions (token, user_id, expires_at) VALUES (${sqlStr(L_TOKEN2)}, ${sqlStr(U.L.id)}, datetime('now', '+1 day'));`);
  // Usuário E já com 100 livros (limite por dono).
  lines.push(`WITH RECURSIVE c(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM c WHERE n < 100)
    INSERT INTO books (owner_id, title, author, category) SELECT ${sqlStr(U.E.id)}, 'Fixture ${RUN} ' || n, 'Autor Fixture', 'tecnico' FROM c;`);
  const dir = mkdtempSync(join(tmpdir(), 'e2e-p26-'));
  const file = join(dir, `fixtures-${RUN}.sql`);
  writeFileSync(file, lines.join('\n') + '\n', 'utf8');
  try {
    execSync(`npx wrangler d1 execute DB --local --yes --file "${file}"`, { cwd: PROJECT, stdio: 'pipe', env: { ...process.env, CI: '1' } });
  } finally {
    try { unlinkSync(file); } catch { /* ok */ }
  }
}

// ---------------------------------------------------------------- helpers de domínio
let bookSeq = 0;
function bookBody(over = {}) {
  bookSeq++;
  return { title: `Livro ${RUN} #${bookSeq}`, author: 'Autora E2E', category: 'tecnico', mode: 'ambos', condition: 'bom', ...over };
}
async function mkBook(u, over = {}) {
  const r = await call('POST', '/api/books', { token: u.token, body: bookBody(over) });
  if (r.status !== 201 || !r.json?.book?.id) throw new Error(`fixture: criar livro falhou: ${show(r)}`);
  return r.json.book;
}
async function getBook(id, u) {
  const r = await call('GET', `/api/books/${id}`, { token: u?.token });
  return r.json?.book || null;
}
async function mkReq(u, bookId, type = 'emprestimo', extra = {}) {
  return call('POST', '/api/requests', { token: u.token, body: { book_id: bookId, type, ...extra } });
}
const act = (u, id, action, body) => call('POST', `/api/requests/${id}/${action}`, body === undefined ? { token: u.token } : { token: u.token, body });
async function box(u, which) {
  const r = await call('GET', `/api/requests?box=${which}`, { token: u.token });
  return r.json?.requests || [];
}
const pendingOf = async (u) => (await box(u, 'outgoing')).filter((x) => x.status === 'pendente').length;
const USER_PUBLIC_KEYS = ['avatar_url', 'display_name', 'user_id', 'username'];
const isUserPublic = (o) => o && JSON.stringify(Object.keys(o).sort()) === JSON.stringify(USER_PUBLIC_KEYS);

// ================================================================= casos
async function main() {
  console.log(`E2E ${CHAVE} contra ${BASE} (run ${RUN})`);
  const st = await call('GET', '/api/status');
  if (st.status !== 200 || !st.json?.d1) {
    console.log(`FAIL [setup] /api/status com d1=true :: ${show(st)}`);
    process.exit(1);
  }
  setupFixtures();
  const { A, B, C, S, T, D, P, E, L, X, Q, M } = U;
  const RACERS = [U.R1, U.R2, U.R3, U.R4, U.R5, U.R6];

  // ------------------------------------------------------------- 0. diagnóstico
  group('G0', 'Diagnóstico');
  check('/api/status devolve chave e d1=true', st.json.ok === true && st.json.chave === CHAVE && st.json.d1 === true, st.json);
  check('/api/status Content-Type application/json; charset=utf-8', (st.headers.get('content-type') || '').toLowerCase() === 'application/json; charset=utf-8', st.headers.get('content-type'));

  // ------------------------------------------------------------- 1. autenticação
  group('G1', 'Autenticação');
  let r = await call('POST', '/api/books', { body: bookBody() });
  check('POST /api/books sem cookie → 401 unauthorized', errIs(r, 401, 'unauthorized'), show(r));
  check('erro segue formato { error, message }', r.json && typeof r.json.error === 'string' && typeof r.json.message === 'string', r.json);
  r = await call('POST', '/api/books', { token: hex64(), body: bookBody() });
  check('POST /api/books com token inventado (64 hex) → 401', errIs(r, 401), show(r));
  r = await call('POST', '/api/books', { cookie: "session=' OR 1=1 --", body: bookBody() });
  check('POST /api/books com token malformado/SQLi → 401', errIs(r, 401), show(r));
  r = await call('POST', '/api/books', { token: X.token, body: bookBody() });
  check('POST /api/books com sessão expirada → 401', errIs(r, 401), show(r));
  r = await call('GET', '/api/me');
  check('GET /api/me deslogado → 200 { user: null }', r.status === 200 && r.json && r.json.user === null, show(r));
  r = await call('GET', '/api/me', { token: X.token });
  check('GET /api/me com sessão expirada → { user: null }', r.status === 200 && r.json?.user === null, show(r));
  r = await call('GET', '/api/me', { token: A.token });
  check('GET /api/me logado → UserPublic do dono da sessão', r.status === 200 && r.json?.user?.user_id === A.id && r.json.user.username === A.username, show(r));
  check('GET /api/me expõe apenas campos de UserPublic', isUserPublic(r.json?.user), r.json?.user && Object.keys(r.json.user));
  const unauthWrites = [
    ['PATCH', '/api/books/1', { title: 'x' }], ['DELETE', '/api/books/1', undefined],
    ['POST', '/api/requests', { book_id: 1, type: 'emprestimo' }],
    ['POST', '/api/requests/1/approve', { due_date: ymd(7) }], ['POST', '/api/requests/1/reject', undefined],
    ['POST', '/api/requests/1/cancel', undefined], ['POST', '/api/requests/1/return', undefined],
  ];
  for (const [m, p, b] of unauthWrites) {
    r = await call(m, p, b === undefined ? {} : { body: b });
    check(`${m} ${p} sem cookie → 401`, errIs(r, 401), show(r));
  }
  r = await call('GET', '/api/requests?box=incoming');
  check('GET /api/requests sem cookie → 401', errIs(r, 401), show(r));
  r = await call('GET', '/api/books?owner=me');
  check('GET /api/books?owner=me sem cookie → 401', errIs(r, 401), show(r));
  r = await call('GET', '/api/books');
  check('GET /api/books público sem login → 200 e is_mine=false em todos', r.status === 200 && Array.isArray(r.json?.books) && r.json.books.every((b) => b.is_mine === false), show(r));
  // logout
  r = await call('POST', '/api/auth/logout', { token: L.token });
  const clear = r.setCookies.find((c) => /^session=/.test(c)) || '';
  check('POST /api/auth/logout (sem corpo) → 200 { ok: true }', r.status === 200 && r.json?.ok === true, show(r));
  check('logout expira o cookie session (Max-Age=0, HttpOnly)', /Max-Age=0/i.test(clear) && /HttpOnly/i.test(clear), r.setCookies);
  r = await call('GET', '/api/me', { token: L.token });
  check('após logout o token antigo não autentica (/api/me → null)', r.status === 200 && r.json?.user === null, show(r));
  r = await call('POST', '/api/books', { token: L.token, body: bookBody() });
  check('após logout o token antigo não escreve (401)', errIs(r, 401), show(r));
  r = await call('GET', '/api/me', { token: L_TOKEN2 });
  check('logout apaga só a própria sessão (outra sessão do mesmo usuário continua)', r.json?.user?.user_id === L.id, show(r));
  r = await call('POST', '/api/auth/logout');
  check('logout sem cookie → 200', r.status === 200 && r.json?.ok === true, show(r));
  r = await call('GET', '/api/auth/logout');
  check('GET /api/auth/logout → 405 (só POST)', r.status === 405, show(r));

  // ------------------------------------------------------------- 2. OAuth
  group('G2', 'OAuth Discord');
  if (!st.json.discord_configured) {
    r = await call('GET', '/api/auth/discord');
    check('sem DISCORD_CLIENT_ID → 500 JSON not_configured', errIs(r, 500, 'not_configured'), show(r));
    r = await call('GET', '/api/auth/discord/callback?code=x&state=y');
    check('callback sem configuração → 500 not_configured (sem chamar o Discord)', errIs(r, 500, 'not_configured'), show(r));
    skip('redirecionamento ao Discord / validação de state', 'Discord não configurado neste servidor (rode com .dev.vars de teste)');
  } else {
    r = await call('GET', '/api/auth/discord');
    const loc = r.headers.get('location') || '';
    let u = null; try { u = new URL(loc); } catch { /* */ }
    const sc = r.setCookies.find((c) => /^oauth_state=/.test(c)) || '';
    const cookieState = (sc.match(/^oauth_state=([^;]*)/) || [])[1];
    check('GET /api/auth/discord → 302', r.status === 302, show(r));
    check('redireciona para https://discord.com/oauth2/authorize', u && u.origin === 'https://discord.com' && u.pathname === '/oauth2/authorize', loc);
    check('scope=identify e response_type=code', u && u.searchParams.get('scope') === 'identify' && u.searchParams.get('response_type') === 'code', loc);
    check('redirect_uri aponta para /api/auth/discord/callback do próprio site', u && u.searchParams.get('redirect_uri') === `${ORIGIN}/api/auth/discord/callback`, u && u.searchParams.get('redirect_uri'));
    const state = u && u.searchParams.get('state');
    check('state aleatório (64 hex) presente na URL', /^[0-9a-f]{64}$/.test(state || ''), state);
    check('cookie oauth_state = state, HttpOnly, Max-Age=600', cookieState === state && /HttpOnly/i.test(sc) && /Max-Age=600/i.test(sc), sc);
    const r2 = await call('GET', '/api/auth/discord');
    const st2 = new URL(r2.headers.get('location')).searchParams.get('state');
    check('cada início de login gera state novo', st2 && st2 !== state);
    const cb = (qs, cookie) => call('GET', `/api/auth/discord/callback${qs}`, { cookie });
    const errOf = (x) => { try { return new URL(x.headers.get('location'), BASE).searchParams.get('auth_error'); } catch { return null; } };
    const noSession = (x) => !x.setCookies.some((c) => /^session=[^;]+/.test(c) && !/^session=;/.test(c));
    r = await cb(`?code=abc&state=${state}`);
    check('callback sem cookie oauth_state → 302 /?auth_error=invalid_state', r.status === 302 && errOf(r) === 'invalid_state', show(r) + ' ' + r.headers.get('location'));
    check('…e não cria sessão', noSession(r), r.setCookies);
    r = await cb(`?code=abc&state=${hex64()}`, `oauth_state=${state}`);
    check('callback com state divergente → auth_error=invalid_state', r.status === 302 && errOf(r) === 'invalid_state', r.headers.get('location'));
    check('…e não cria sessão (divergente)', noSession(r), r.setCookies);
    r = await cb('?code=abc', `oauth_state=${state}`);
    check('callback sem state na URL → invalid_state', r.status === 302 && errOf(r) === 'invalid_state', r.headers.get('location'));
    r = await cb('?code=abc&state=', 'oauth_state=');
    check('callback com state e cookie vazios → invalid_state', r.status === 302 && errOf(r) === 'invalid_state', r.headers.get('location'));
    r = await cb(`?state=${state}`, `oauth_state=${state}`);
    check('callback com state correto e sem code → auth_error=missing_code', r.status === 302 && errOf(r) === 'missing_code', r.headers.get('location'));
    r = await cb('?error=access_denied');
    check('callback ?error=access_denied → auth_error=access_denied', r.status === 302 && errOf(r) === 'access_denied', r.headers.get('location'));
    r = await cb(`?error=${encodeURIComponent('<script>alert(1)</script>')}`);
    check('callback ?error=<script> é normalizado (auth_error=oauth_error)', r.status === 302 && errOf(r) === 'oauth_error', r.headers.get('location'));
    r = await cb(`?code=fake_code_${RUN}&state=${state}`, `oauth_state=${state}`);
    const e = errOf(r);
    check('callback com state correto + code falso → 302 com auth_error (troca de token falha, sem 500)', r.status === 302 && !!e && e !== 'invalid_state', `${r.status} ${r.headers.get('location')}`);
    check('…e não cria sessão (code falso)', noSession(r), r.setCookies);
    check('…e limpa oauth_state', r.setCookies.some((c) => /^oauth_state=;/.test(c) && /Max-Age=0/i.test(c)), r.setCookies);
  }

  // ------------------------------------------------------------- 3. autoria
  group('G3', 'Autoria (403)');
  const a1 = await mkBook(A, { mode: 'ambos' });
  const a2 = await mkBook(A);
  r = await mkReq(C, a1.id, 'emprestimo');
  check('fixture: C pede empréstimo de a1 → 201', r.status === 201, show(r));
  const req1 = r.json?.request;
  r = await call('PATCH', `/api/books/${a2.id}`, { token: B.token, body: { title: 'Hackeado' } });
  check('B edita livro de A → 403', errIs(r, 403), show(r));
  check('…título de A continua o mesmo', (await getBook(a2.id))?.title === a2.title);
  r = await call('DELETE', `/api/books/${a2.id}`, { token: B.token });
  check('B exclui livro Disponível de A → 403', errIs(r, 403), show(r));
  check('…livro continua existindo', !!(await getBook(a2.id)));
  r = await act(B, req1.id, 'approve', { due_date: ymd(7) });
  check('B aprova pedido de livro de A → 403', errIs(r, 403), show(r));
  r = await act(B, req1.id, 'reject');
  check('B recusa pedido de livro de A → 403', errIs(r, 403), show(r));
  r = await act(B, req1.id, 'cancel');
  check('B cancela pedido de C → 403', errIs(r, 403), show(r));
  r = await act(C, req1.id, 'approve', { due_date: ymd(7) });
  check('solicitante C aprova o próprio pedido → 403', errIs(r, 403), show(r));
  r = await act(C, req1.id, 'reject');
  check('solicitante C recusa o próprio pedido → 403', errIs(r, 403), show(r));
  r = await act(A, req1.id, 'cancel');
  check('dono A cancela pedido de C (só solicitante cancela) → 403', errIs(r, 403), show(r));
  check('B não vê o pedido em incoming/outgoing', !(await box(B, 'incoming')).some((x) => x.id === req1.id) && !(await box(B, 'outgoing')).some((x) => x.id === req1.id));
  r = await act(A, req1.id, 'approve', { due_date: ymd(1) });
  check('dono aprova com due_date = amanhã (limite inferior) → 200', r.status === 200 && r.json?.request?.status === 'aprovado' && r.json.request.due_date === ymd(1), show(r));
  r = await act(B, req1.id, 'return');
  check('B registra devolução de pedido de A → 403', errIs(r, 403), show(r));
  r = await act(C, req1.id, 'return');
  check('solicitante C registra a própria devolução → 403', errIs(r, 403), show(r));
  check('…livro continua Emprestado com C', (await getBook(a1.id))?.status === 'Emprestado');
  r = await act(A, req1.id, 'return');
  check('dono registra devolução → 200', r.status === 200 && r.json?.request?.status === 'devolvido', show(r));
  r = await call('DELETE', `/api/books/999999999`, { token: B.token });
  check('excluir livro inexistente → 404', errIs(r, 404), show(r));
  r = await act(B, 999999999, 'approve', { due_date: ymd(7) });
  check('aprovar pedido inexistente → 404', errIs(r, 404), show(r));

  // ------------------------------------------------------------- 4. regras de estado
  group('G4', 'Regras de estado');
  r = await mkReq(A, a2.id);
  check('pedir o próprio livro → 403 own_book', errIs(r, 403, 'own_book'), show(r));
  r = await mkReq(S, 999999999);
  check('pedir livro inexistente → 404', errIs(r, 404), show(r));
  for (const bad of ['abc', -1, 0, 1.5, null, true, '1e3', ' ']) {
    r = await mkReq(S, bad);
    check(`book_id inválido (${JSON.stringify(bad)}) → 400`, errIs(r, 400), show(r));
  }
  r = await call('POST', '/api/requests', { token: S.token, body: { type: 'emprestimo' } });
  check('book_id ausente → 400', errIs(r, 400), show(r));
  r = await mkReq(S, a2.id, 'compra');
  check('type inválido → 400', errIs(r, 400), show(r));
  r = await mkReq(S, a2.id, 'emprestimo', { message: 'x'.repeat(501) });
  check('message com 501 caracteres → 400', errIs(r, 400), show(r));
  const bT = await mkBook(A, { mode: 'troca' });
  const bE = await mkBook(A, { mode: 'emprestimo' });
  r = await mkReq(S, bT.id, 'emprestimo');
  check('empréstimo em livro só-troca → 400 mode_not_allowed', errIs(r, 400, 'mode_not_allowed'), show(r));
  r = await mkReq(S, bE.id, 'troca');
  check('troca em livro só-empréstimo → 400 mode_not_allowed', errIs(r, 400, 'mode_not_allowed'), show(r));
  check('…livros continuam Disponível', (await getBook(bT.id)).status === 'Disponível' && (await getBook(bE.id)).status === 'Disponível');
  const sB1 = await mkBook(S);
  r = await mkReq(S, bE.id, 'emprestimo', { offered_book_id: sB1.id });
  check('offered_book_id em empréstimo → 400', errIs(r, 400), show(r));
  r = await mkReq(S, bT.id, 'troca', { offered_book_id: a2.id });
  check('oferecer livro que não é seu → 403', errIs(r, 403), show(r));
  r = await mkReq(S, bT.id, 'troca', { offered_book_id: 999999999 });
  check('oferecer livro inexistente → 404', errIs(r, 404), show(r));
  check('…nenhuma das tentativas inválidas reservou bT', (await getBook(bT.id)).status === 'Disponível');
  // Reservado / Emprestado
  const bR = await mkBook(A);
  r = await mkReq(S, bR.id);
  check('S pede bR → 201 e livro Reservado', r.status === 201 && (await getBook(bR.id)).status === 'Reservado', show(r));
  const reqR = r.json?.request;
  r = await mkReq(B, bR.id);
  check('pedir livro Reservado → 409', errIs(r, 409), show(r));
  r = await call('DELETE', `/api/books/${bR.id}`, { token: A.token });
  check('excluir livro Reservado → 409', errIs(r, 409), show(r));
  check('…livro Reservado não foi excluído', !!(await getBook(bR.id)));
  // validação de due_date (pedido continua pendente após cada erro)
  const dueCases = [
    ['sem corpo', undefined], ['corpo {}', {}], ['ontem', { due_date: ymd(-1) }], ['hoje', { due_date: ymd(0) }],
    ['hoje+91', { due_date: ymd(91) }], ['data inexistente 2027-02-30', { due_date: '2027-02-30' }],
    ['formato DD/MM/AAAA', { due_date: '17/12/2026' }], ['número', { due_date: 20261201 }],
    ['com hora', { due_date: `${ymd(5)}T00:00:00Z` }], ['ano 9999', { due_date: '9999-01-01' }],
  ];
  for (const [label, body] of dueCases) {
    r = await act(A, reqR.id, 'approve', body);
    check(`aprovar empréstimo com due_date ${label} → 400`, errIs(r, 400), show(r));
  }
  check('…após as tentativas o pedido continua pendente e o livro Reservado', (await box(S, 'outgoing')).find((x) => x.id === reqR.id)?.status === 'pendente' && (await getBook(bR.id)).status === 'Reservado');
  r = await act(A, reqR.id, 'approve', { due_date: ymd(90) });
  check('aprovar com due_date = hoje+90 (limite superior) → 200', r.status === 200 && r.json?.request?.due_date === ymd(90), show(r));
  r = await mkReq(B, bR.id);
  check('pedir livro Emprestado → 409', errIs(r, 409), show(r));
  r = await call('DELETE', `/api/books/${bR.id}`, { token: A.token });
  check('excluir livro Emprestado → 409', errIs(r, 409), show(r));
  r = await act(A, reqR.id, 'approve', { due_date: ymd(10) });
  check('aprovar pedido já aprovado → 409', errIs(r, 409), show(r));
  r = await act(A, reqR.id, 'reject');
  check('recusar pedido já aprovado → 409', errIs(r, 409), show(r));
  r = await act(S, reqR.id, 'cancel');
  check('cancelar pedido já aprovado → 409', errIs(r, 409), show(r));
  check('…livro continua Emprestado com S e due_date intacta', (() => true)() && (await getBook(bR.id)).holder?.user_id === S.id && (await getBook(bR.id)).due_date === ymd(90));
  r = await act(A, reqR.id, 'return');
  check('registrar devolução → 200', r.status === 200, show(r));
  r = await act(A, reqR.id, 'return');
  check('registrar devolução duas vezes → 409', errIs(r, 409), show(r));
  // troca com livro oferecido já Reservado
  r = await mkReq(S, bT.id, 'troca', { offered_book_id: sB1.id });
  check('S propõe troca de bT oferecendo sB1 → 201, ambos Reservado', r.status === 201 && (await getBook(bT.id)).status === 'Reservado' && (await getBook(sB1.id)).status === 'Reservado', show(r));
  const reqT = r.json?.request;
  const bT2 = await mkBook(A, { mode: 'troca' });
  r = await mkReq(S, bT2.id, 'troca', { offered_book_id: sB1.id });
  check('oferecer livro já Reservado em outra troca → 409', errIs(r, 409), show(r));
  check('…bT2 não ficou Reservado', (await getBook(bT2.id)).status === 'Disponível');
  r = await mkReq(B, sB1.id, 'troca');
  check('pedir o livro oferecido (Reservado) → 409', errIs(r, 409), show(r));
  r = await call('DELETE', `/api/books/${sB1.id}`, { token: S.token });
  check('excluir o próprio livro oferecido (Reservado) → 409', errIs(r, 409), show(r));
  r = await act(A, reqT.id, 'return');
  check('registrar devolução de troca pendente → 409', errIs(r, 409), show(r));
  r = await act(A, reqT.id, 'reject');
  check('recusar troca → 200 recusado', r.status === 200 && r.json?.request?.status === 'recusado', show(r));
  check('…recusa libera livro pedido e oferecido', (await getBook(bT.id)).status === 'Disponível' && (await getBook(sB1.id)).status === 'Disponível');
  r = await act(S, reqT.id, 'cancel');
  check('cancelar pedido já recusado → 409', errIs(r, 409), show(r));
  r = await act(A, reqT.id, 'approve');
  check('aprovar pedido já recusado → 409', errIs(r, 409), show(r));
  // limite de 3 pendentes
  const dBooks = [];
  for (let i = 0; i < 4; i++) dBooks.push(await mkBook(A));
  const dReqs = [];
  for (let i = 0; i < 3; i++) { r = await mkReq(D, dBooks[i].id); dReqs.push(r.json?.request); check(`D faz pedido pendente nº ${i + 1} → 201`, r.status === 201, show(r)); }
  r = await mkReq(D, dBooks[3].id);
  check('4º pedido pendente → 429 too_many_pending', errIs(r, 429, 'too_many_pending'), show(r));
  check('…4º livro não ficou Reservado', (await getBook(dBooks[3].id)).status === 'Disponível');
  r = await act(D, dReqs[0].id, 'cancel');
  check('cancelar libera vaga; livro volta a Disponível', r.status === 200 && r.json?.request?.status === 'cancelado' && (await getBook(dBooks[0].id)).status === 'Disponível', show(r));
  r = await mkReq(D, dBooks[3].id);
  check('após cancelar, novo pedido → 201', r.status === 201, show(r));
  // limite de 100 livros
  r = await call('POST', '/api/books', { token: E.token, body: bookBody() });
  check('usuário com 100 livros cria o 101º → 429', errIs(r, 429), show(r));

  // ------------------------------------------------------------- 5. campos protegidos
  group('G5', 'Campos protegidos');
  r = await call('POST', '/api/books', {
    token: A.token,
    body: bookBody({ status: 'Emprestado', owner_id: B.id, holder_id: B.id, due_date: ymd(5), id: 1, is_mine: false, created_at: '2000-01-01 00:00:00', owner: { user_id: B.id } }),
  });
  const pb = r.json?.book;
  check('POST com status/owner_id/holder_id injetados → 201', r.status === 201, show(r));
  check('…status = Disponível', pb?.status === 'Disponível', pb);
  check('…dono = quem chamou (A), não B', pb?.owner?.user_id === A.id, pb?.owner);
  check('…holder = null e due_date = null', pb?.holder === null && pb?.due_date === null, pb);
  check('…id e created_at não vieram do cliente', pb?.id !== 1 && !String(pb?.created_at).startsWith('2000'), pb);
  const pbDb = await getBook(pb.id, A);
  check('…GET confirma: Disponível, dono A, is_mine=true para A', pbDb?.status === 'Disponível' && pbDb.owner.user_id === A.id && pbDb.is_mine === true, pbDb);
  check('…B não vê o livro em owner=me', !((await call('GET', '/api/books?owner=me', { token: B.token })).json.books.some((b) => b.id === pb.id)));
  r = await call('PATCH', `/api/books/${pb.id}`, { token: A.token, body: { status: 'Emprestado', owner_id: B.id, holder_id: B.id } });
  let after = await getBook(pb.id);
  check('PATCH só com campos protegidos não altera nada (400 no_fields ou 200)', (r.status === 400 || r.status === 200) && after.status === 'Disponível' && after.owner.user_id === A.id && after.holder === null, `${show(r)} / ${JSON.stringify(after)}`);
  r = await call('PATCH', `/api/books/${pb.id}`, { token: A.token, body: { title: 'Título editado', status: 'Reservado', owner_id: B.id, holder_id: B.id, due_date: ymd(3) } });
  after = await getBook(pb.id);
  check('PATCH título + campos protegidos → 200, só o título muda', r.status === 200 && after.title === 'Título editado' && after.status === 'Disponível' && after.owner.user_id === A.id && after.holder === null && after.due_date === null, `${show(r)} / ${JSON.stringify(after)}`);
  r = await call('PATCH', `/api/books/${pb.id}`, { token: A.token, body: { description: 'nova' } });
  after = await getBook(pb.id);
  check('PATCH parcial preserva os demais campos', r.status === 200 && after.title === 'Título editado' && after.description === 'nova' && after.mode === pb.mode, after);
  r = await call('PATCH', `/api/books/${pb.id}`, { token: A.token, body: { title: '' } });
  check('PATCH com título vazio → 400', errIs(r, 400), show(r));
  r = await mkReq(C, pb.id, 'emprestimo', { status: 'aprovado', requester_id: B.id, owner_id: C.id, due_date: ymd(5), type_override: 'x' });
  const pReq = r.json?.request;
  check('POST /api/requests com status/requester_id/owner_id injetados → 201 pendente', r.status === 201 && pReq?.status === 'pendente', show(r));
  check('…solicitante = C, dono = A, due_date = null', pReq?.requester?.user_id === C.id && pReq?.owner?.user_id === A.id && pReq?.due_date === null, pReq);
  check('…objeto Request no formato do contrato', pReq && isUserPublic(pReq.requester) && isUserPublic(pReq.owner) && pReq.book?.id === pb.id && pReq.book.status === 'Reservado' && pReq.offered_book === null && 'decided_at' in pReq && 'returned_at' in pReq, pReq);
  r = await call('PATCH', `/api/books/${pb.id}`, { token: A.token, body: { status: 'Disponível', description: 'tentando liberar' } });
  check('PATCH status=Disponível em livro Reservado não o libera', (await getBook(pb.id)).status === 'Reservado', show(r));
  r = await mkReq(B, pb.id);
  check('…outro usuário continua recebendo 409', errIs(r, 409), show(r));
  r = await act(A, pReq.id, 'approve', { due_date: ymd(6), holder_id: B.id, status: 'devolvido', requester_id: B.id });
  after = await getBook(pb.id);
  check('approve com holder_id/status injetados: holder = solicitante C, status aprovado', r.status === 200 && r.json.request.status === 'aprovado' && after.holder?.user_id === C.id && after.status === 'Emprestado', `${show(r)} / ${JSON.stringify(after)}`);
  r = await act(A, pReq.id, 'return');
  check('…devolução limpa holder', r.status === 200 && (await getBook(pb.id)).holder === null);

  // ------------------------------------------------------------- 6. fluxos felizes
  group('G6', 'Fluxos felizes');
  // empréstimo
  const ACC = 'Memórias Póstumas de Brás Cubas';
  r = await call('POST', '/api/books', { token: A.token, body: { title: ACC, author: 'Machado de Assis', category: 'literario', mode: 'emprestimo', condition: 'usado', isbn: '978-85-359-0277-x', description: 'Edição com notas — “ao verme que primeiro roeu…”' } });
  const lb = r.json?.book;
  check('criar livro com título acentuado → 201', r.status === 201, show(r));
  check('…título acentuado gravado byte a byte', lb?.title === ACC, lb?.title);
  check('…ISBN com x minúsculo normalizado para X', lb?.isbn === '978-85-359-0277-X', lb?.isbn);
  check('…objeto Book no formato do contrato', lb && isUserPublic(lb.owner) && lb.holder === null && lb.is_mine === true && lb.status === 'Disponível' && lb.category === 'literario' && lb.condition === 'usado' && typeof lb.created_at === 'string', lb);
  r = await call('GET', `/api/books?q=${encodeURIComponent('Memórias Póstumas')}`);
  check('busca q com acento encontra o livro', r.status === 200 && r.json.books.some((b) => b.id === lb.id), show(r));
  r = await call('GET', `/api/books?q=${encodeURIComponent('machado')}&category=literario&mode=emprestimo&status=${encodeURIComponent('Disponível')}`);
  check('busca por autor (case-insensitive) + filtros encontra o livro', r.status === 200 && r.json.books.some((b) => b.id === lb.id), show(r));
  r = await call('GET', `/api/books?mode=troca`);
  check('filtro mode=troca não traz livro só-empréstimo', r.status === 200 && !r.json.books.some((b) => b.id === lb.id) && r.json.books.every((b) => b.mode === 'troca' || b.mode === 'ambos'), show(r));
  r = await call('GET', `/api/books?category=tecnico`);
  check('filtro category=tecnico só traz técnicos', r.status === 200 && r.json.books.length > 0 && r.json.books.every((b) => b.category === 'tecnico'));
  check('lista limitada a 200 e ordenada por created_at DESC', r.json.books.length <= 200 && r.json.books.every((b, i, arr) => i === 0 || arr[i - 1].created_at >= b.created_at));
  r = await mkReq(C, lb.id, 'emprestimo', { message: 'Posso buscar na biblioteca amanhã?' });
  const lr = r.json?.request;
  check('C pede empréstimo → 201 pendente', r.status === 201 && lr?.status === 'pendente' && lr.type === 'emprestimo' && lr.message === 'Posso buscar na biblioteca amanhã?', show(r));
  check('…livro Reservado', (await getBook(lb.id)).status === 'Reservado');
  check('…aparece em incoming de A e outgoing de C', (await box(A, 'incoming')).some((x) => x.id === lr.id) && (await box(C, 'outgoing')).some((x) => x.id === lr.id));
  r = await call('GET', '/api/requests?box=tudo', { token: A.token });
  check('box inválido → 400', errIs(r, 400), show(r));
  const due14 = ymd(14);
  r = await act(A, lr.id, 'approve', { due_date: due14 });
  check('A aprova com due_date hoje+14 → 200 aprovado', r.status === 200 && r.json.request.status === 'aprovado' && r.json.request.due_date === due14 && r.json.request.decided_at, show(r));
  let lbNow = await getBook(lb.id);
  check('…livro Emprestado, holder = C, due_date gravada', lbNow.status === 'Emprestado' && lbNow.holder?.user_id === C.id && isUserPublic(lbNow.holder) && lbNow.due_date === due14, lbNow);
  r = await call('PATCH', `/api/books/${lb.id}`, { token: C.token, body: { title: 'Agora é meu' } });
  check('portador (holder) não pode editar o livro → 403', errIs(r, 403), show(r));
  r = await act(A, lr.id, 'return');
  check('A registra devolução → 200 devolvido com returned_at', r.status === 200 && r.json.request.status === 'devolvido' && !!r.json.request.returned_at, show(r));
  lbNow = await getBook(lb.id);
  check('…livro Disponível, holder e due_date nulos, dono A', lbNow.status === 'Disponível' && lbNow.holder === null && lbNow.due_date === null && lbNow.owner.user_id === A.id, lbNow);
  // troca com livro oferecido
  const tA = await mkBook(A, { mode: 'troca', title: `Troca A ${RUN}` });
  const tC = await mkBook(T, { mode: 'ambos', title: `Troca T ${RUN}` });
  r = await mkReq(T, tA.id, 'troca', { offered_book_id: tC.id, message: 'Troco pelo meu' });
  const tr = r.json?.request;
  check('T propõe troca oferecendo tC → 201', r.status === 201 && tr?.offered_book?.id === tC.id, show(r));
  check('…ambos Reservado', (await getBook(tA.id)).status === 'Reservado' && (await getBook(tC.id)).status === 'Reservado');
  r = await call('POST', `/api/requests/${tr.id}/approve`, { token: A.token });
  check('A aprova a troca (sem corpo, sem Content-Type) → 200 concluido', r.status === 200 && r.json?.request?.status === 'concluido', show(r));
  const tAnow = await getBook(tA.id, T), tCnow = await getBook(tC.id, A);
  check('…livro pedido agora pertence a T', tAnow.owner.user_id === T.id && tAnow.is_mine === true, tAnow);
  check('…livro oferecido agora pertence a A', tCnow.owner.user_id === A.id && tCnow.is_mine === true, tCnow);
  check('…ambos Disponível e sem holder', tAnow.status === 'Disponível' && tCnow.status === 'Disponível' && tAnow.holder === null && tCnow.holder === null);
  r = await call('PATCH', `/api/books/${tA.id}`, { token: A.token, body: { title: 'Ainda meu?' } });
  check('antigo dono não edita o livro trocado → 403', errIs(r, 403), show(r));
  r = await call('PATCH', `/api/books/${tA.id}`, { token: T.token, body: { description: 'Agora é meu' } });
  check('novo dono edita o livro trocado → 200', r.status === 200, show(r));
  check('pedido concluído continua no histórico de A (incoming)', (await box(A, 'incoming')).find((x) => x.id === tr.id)?.status === 'concluido');
  // troca sem livro oferecido
  const tA2 = await mkBook(A, { mode: 'ambos' });
  r = await mkReq(T, tA2.id, 'troca');
  const tr2 = r.json?.request;
  check('troca sem livro oferecido → 201', r.status === 201 && tr2?.offered_book === null, show(r));
  r = await act(A, tr2.id, 'approve', { due_date: 'ignorado' });
  check('aprovar troca ignora due_date → 200 concluido', r.status === 200 && r.json.request.status === 'concluido', show(r));
  check('…livro passa para T, Disponível', (await getBook(tA2.id)).owner.user_id === T.id && (await getBook(tA2.id)).status === 'Disponível');
  // cancelamento de troca com oferecido
  const tA3 = await mkBook(A, { mode: 'troca' });
  const tC3 = await mkBook(T);
  r = await mkReq(T, tA3.id, 'troca', { offered_book_id: tC3.id });
  r = await act(T, r.json.request.id, 'cancel');
  check('solicitante cancela troca → cancelado e os dois livros Disponível', r.status === 200 && r.json.request.status === 'cancelado' && (await getBook(tA3.id)).status === 'Disponível' && (await getBook(tC3.id)).status === 'Disponível', show(r));
  // exclusão
  const del = await mkBook(A);
  r = await call('DELETE', `/api/books/${del.id}`, { token: A.token });
  check('dono exclui livro Disponível → 200 { ok: true }', r.status === 200 && r.json?.ok === true, show(r));
  r = await call('GET', `/api/books/${del.id}`);
  check('…GET do livro excluído → 404', errIs(r, 404), show(r));

  // ------------------------------------------------------------- 7. corrida
  group('G7', 'Corrida (concorrência)');
  const rb = await mkBook(A);
  let rs = await Promise.all(RACERS.map((u) => mkReq(u, rb.id)));
  let codes = rs.map((x) => x.status);
  check(`${RACERS.length} pedidos simultâneos no mesmo livro → exatamente um 201`, codes.filter((c) => c === 201).length === 1, codes);
  check('…todos os outros 409', codes.filter((c) => c === 409).length === RACERS.length - 1, codes);
  check('…só um pedido pendente para o livro', (await box(A, 'incoming')).filter((x) => x.book.id === rb.id && x.status === 'pendente').length === 1);
  check('…livro Reservado', (await getBook(rb.id)).status === 'Reservado');
  // corrida do limite de 3 pendentes (mesmo usuário, livros diferentes)
  const pBooks = [];
  for (let i = 0; i < 6; i++) pBooks.push(await mkBook(A));
  rs = await Promise.all(pBooks.map((b) => mkReq(P, b.id)));
  codes = rs.map((x) => x.status);
  check('6 pedidos simultâneos do mesmo usuário → no máximo 3 aceitos', codes.filter((c) => c === 201).length <= 3, codes);
  check('…exatamente 3 aceitos e o resto 429', codes.filter((c) => c === 201).length === 3 && codes.filter((c) => c === 429).length === 3, codes);
  check('…usuário fica com exatamente 3 pendentes', (await pendingOf(P)) === 3);
  const reservedP = (await Promise.all(pBooks.map((b) => getBook(b.id)))).filter((b) => b.status === 'Reservado').length;
  check('…exatamente 3 livros Reservado (nenhum reservado órfão)', reservedP === 3, reservedP);
  // aprovar x cancelar
  const qb = await mkBook(A);
  r = await mkReq(Q, qb.id);
  const qr = r.json.request;
  rs = await Promise.all([act(A, qr.id, 'approve', { due_date: ymd(10) }), act(Q, qr.id, 'cancel')]);
  codes = rs.map((x) => x.status);
  check('aprovar e cancelar ao mesmo tempo → exatamente um 200 e um 409', codes.filter((c) => c === 200).length === 1 && codes.filter((c) => c === 409).length === 1, codes);
  const qbNow = await getBook(qb.id);
  const qStatus = (await box(Q, 'outgoing')).find((x) => x.id === qr.id)?.status;
  check('…estado final coerente (aprovado+Emprestado ou cancelado+Disponível)',
    (qStatus === 'aprovado' && qbNow.status === 'Emprestado' && qbNow.holder?.user_id === Q.id) || (qStatus === 'cancelado' && qbNow.status === 'Disponível' && qbNow.holder === null), { qStatus, qbNow });
  // aprovar duas vezes
  const qb2 = await mkBook(A);
  r = await mkReq(M, qb2.id);
  const qr2 = r.json.request;
  rs = await Promise.all([act(A, qr2.id, 'approve', { due_date: ymd(10) }), act(A, qr2.id, 'approve', { due_date: ymd(20) }), act(A, qr2.id, 'reject')]);
  codes = rs.map((x) => x.status);
  check('aprovar 2x + recusar ao mesmo tempo → exatamente um 200', codes.filter((c) => c === 200).length === 1 && codes.filter((c) => c === 409).length === 2, codes);
  const qb2Now = await getBook(qb2.id);
  const qr2Now = (await box(M, 'outgoing')).find((x) => x.id === qr2.id);
  check('…livro e pedido coerentes', (qr2Now.status === 'aprovado' && qb2Now.status === 'Emprestado' && qb2Now.due_date === qr2Now.due_date) || (qr2Now.status === 'recusado' && qb2Now.status === 'Disponível'), { qr2Now, qb2Now });
  // mesmo livro oferecido em duas trocas simultâneas
  const off = await mkBook(M);
  const t1 = await mkBook(A, { mode: 'troca' }), t2 = await mkBook(B, { mode: 'troca' });
  rs = await Promise.all([mkReq(M, t1.id, 'troca', { offered_book_id: off.id }), mkReq(M, t2.id, 'troca', { offered_book_id: off.id })]);
  codes = rs.map((x) => x.status);
  check('mesmo livro oferecido em duas trocas simultâneas → exatamente um 201', codes.filter((c) => c === 201).length === 1, codes);
  const t1s = (await getBook(t1.id)).status, t2s = (await getBook(t2.id)).status;
  check('…só um dos livros pedidos ficou Reservado', [t1s, t2s].filter((s) => s === 'Reservado').length === 1, { t1s, t2s });
  // excluir x pedir
  const xb = await mkBook(A);
  rs = await Promise.all([call('DELETE', `/api/books/${xb.id}`, { token: A.token }), mkReq(B, xb.id)]);
  codes = rs.map((x) => x.status);
  const xbNow = await getBook(xb.id);
  check('excluir e pedir ao mesmo tempo → estado coerente', (codes[0] === 200 && codes[1] !== 201 && !xbNow) || (codes[0] === 409 && codes[1] === 201 && xbNow?.status === 'Reservado') || (codes[0] === 200 && codes[1] === 404 && !xbNow), { codes, xbNow });

  // ------------------------------------------------------------- 8. entrada maliciosa
  group('G8', 'Entrada maliciosa');
  const SQLI = "'; DROP TABLE books; --";
  const XSS = '<img src=x onerror=alert(1)>';
  r = await call('POST', '/api/books', { token: B.token, body: bookBody({ title: SQLI, author: XSS, description: '<script>alert("d")</script>' }) });
  const mb = r.json?.book;
  check('título SQLi → 201 e gravado literalmente', r.status === 201 && mb?.title === SQLI, show(r));
  check('autor XSS gravado literalmente (sem escape/strip no servidor)', mb?.author === XSS, mb?.author);
  check('descrição <script> gravada literalmente', mb?.description === '<script>alert("d")</script>');
  r = await call('GET', `/api/books/${mb.id}`);
  check('…GET devolve exatamente as strings', r.json?.book?.title === SQLI && r.json.book.author === XSS);
  r = await call('GET', '/api/books');
  check('…tabela books continua existindo (lista 200)', r.status === 200 && Array.isArray(r.json?.books));
  r = await call('POST', '/api/books', { token: B.token, body: bookBody({ title: XSS }) });
  check('título XSS → gravado literalmente', r.status === 201 && r.json.book.title === XSS, show(r));
  const xssReqBook = await mkBook(B);
  r = await mkReq(C, xssReqBook.id, 'emprestimo', { message: XSS });
  check('mensagem XSS no pedido gravada literalmente', r.status === 201 && r.json.request.message === XSS, show(r));
  if (r.json?.request) await act(C, r.json.request.id, 'cancel');
  r = await call('POST', '/api/books', { token: B.token, body: bookBody({ title: `100% Garantido_${RUN}` }) });
  check('fixture: livro com % e _ no título', r.status === 201);
  r = await call('GET', '/api/books?q=%25');
  const all = (await call('GET', '/api/books')).json.books;
  check('q=% não lista tudo: só livros com "%" literal', r.status === 200 && r.json.books.length > 0 && r.json.books.every((b) => b.title.includes('%') || b.author.includes('%')) && r.json.books.length < all.length, `${r.json?.books?.length} de ${all.length}`);
  r = await call('GET', '/api/books?q=_');
  check('q=_ só livros com "_" literal', r.status === 200 && r.json.books.every((b) => b.title.includes('_') || b.author.includes('_')), r.json?.books?.map((b) => b.title).slice(0, 5));
  r = await call('GET', `/api/books?q=${encodeURIComponent("' OR '1'='1")}`);
  check("q=' OR '1'='1 → 200 sem listar tudo", r.status === 200 && r.json.books.every((b) => (b.title + b.author).includes("' OR '1'='1")), r.json?.books?.length);
  r = await call('GET', `/api/books?q=${encodeURIComponent('\\')}`);
  check('q=\\ (caractere de escape do LIKE) → 200 sem erro', r.status === 200, show(r));
  r = await call('GET', `/api/books?q=${'a'.repeat(101)}`);
  check('q com 101 caracteres → 400', errIs(r, 400), show(r));
  for (const [k, v] of [['category', 'foo'], ['status', 'Perdido'], ['mode', "ambos' OR 1=1"], ['owner', B.id]]) {
    r = await call('GET', `/api/books?${k}=${encodeURIComponent(v)}`, { token: B.token });
    check(`filtro ${k}=${v} inválido → 400`, errIs(r, 400), show(r));
  }
  // corpo / Content-Type
  const pathB = '/api/books';
  r = await call('POST', pathB, { token: B.token, raw: '{"title": "x", ', ct: 'application/json' });
  check('JSON inválido → 400 invalid_json', errIs(r, 400, 'invalid_json'), show(r));
  r = await call('POST', pathB, { token: B.token, raw: JSON.stringify(bookBody()), ct: 'text/plain' });
  check('Content-Type text/plain → 415', errIs(r, 415), show(r));
  r = await call('POST', pathB, { token: B.token, raw: JSON.stringify(bookBody()) });
  check('corpo sem Content-Type → 415', errIs(r, 415), show(r));
  r = await call('POST', pathB, { token: B.token, raw: 'title=x&author=y', ct: 'application/x-www-form-urlencoded' });
  check('form-urlencoded (CSRF clássico) → 415', errIs(r, 415), show(r));
  r = await call('POST', pathB, { token: B.token, raw: JSON.stringify(bookBody()), ct: 'multipart/form-data; boundary=x' });
  check('multipart/form-data → 415', errIs(r, 415), show(r));
  r = await call('POST', pathB, { token: B.token, raw: JSON.stringify(bookBody()), ct: 'application/jsonx' });
  check('Content-Type application/jsonx (não é application/json) → 415', errIs(r, 415), show(r));
  r = await call('POST', pathB, { token: B.token, raw: JSON.stringify(bookBody()), ct: 'Application/JSON; charset=utf-8' });
  check('Content-Type Application/JSON; charset=utf-8 aceito → 201', r.status === 201, show(r));
  for (const [label, raw] of [['array', '[]'], ['null', 'null'], ['string', '"x"'], ['número', '42']]) {
    r = await call('POST', pathB, { token: B.token, raw, ct: 'application/json' });
    check(`corpo JSON ${label} → 400`, errIs(r, 400), show(r));
  }
  r = await call('POST', pathB, { token: B.token, raw: JSON.stringify({ ...bookBody(), description: 'x'.repeat(30000) }), ct: 'application/json' });
  check('corpo > 20000 caracteres → 400', errIs(r, 400), show(r));
  r = await call('POST', pathB, { token: B.token, ct: 'application/json', raw: '' });
  check('POST /api/books com corpo vazio → 400', errIs(r, 400), show(r));
  const fieldCases = [
    ['category inválida', { category: 'romance' }], ['mode inválido', { mode: 'venda' }], ['condition inválida', { condition: 'ótimo' }],
    ['título só espaços', { title: '   ' }], ['título 201 caracteres', { title: 'x'.repeat(201) }], ['autor 151 caracteres', { author: 'y'.repeat(151) }],
    ['autor ausente', { author: undefined }], ['título numérico', { title: 12345 }], ['isbn com letras', { isbn: 'ISBN-abc' }],
    ['isbn 21 caracteres', { isbn: '1'.repeat(21) }], ['descrição 1001', { description: 'd'.repeat(1001) }], ['categoria como array', { category: ['tecnico'] }],
  ];
  for (const [label, over] of fieldCases) {
    r = await call('POST', pathB, { token: B.token, body: bookBody(over) });
    check(`POST livro com ${label} → 400`, errIs(r, 400), show(r));
  }
  r = await call('POST', pathB, { token: B.token, body: bookBody({ title: 'x'.repeat(200), author: 'y'.repeat(150), description: 'd'.repeat(1000), isbn: '1'.repeat(20) }) });
  check('POST livro nos limites máximos (200/150/1000/20) → 201', r.status === 201, show(r));
  r = await call('POST', pathB, { token: B.token, body: bookBody({ title: '  Espaços nas pontas  ' }) });
  check('título é aparado (trim)', r.status === 201 && r.json.book.title === 'Espaços nas pontas', r.json?.book?.title);
  // CSRF por Origin
  const evilTitle = `Evil ${RUN}`;
  r = await call('POST', pathB, { token: B.token, origin: 'https://evil.example', body: bookBody({ title: evilTitle }) });
  check('POST com Origin de outro site → 403 bad_origin', errIs(r, 403, 'bad_origin'), show(r));
  r = await call('POST', pathB, { token: B.token, origin: 'null', body: bookBody({ title: evilTitle }) });
  check('POST com Origin: null → 403', errIs(r, 403), show(r));
  r = await call('GET', '/api/books?owner=me', { token: B.token });
  check('…nenhum livro foi criado pelas requisições de outra origem', !r.json.books.some((b) => b.title === evilTitle));
  r = await call('DELETE', `/api/books/${mb.id}`, { token: B.token, origin: 'https://evil.example' });
  check('DELETE com Origin de outro site → 403 e livro preservado', errIs(r, 403) && !!(await getBook(mb.id)), show(r));
  // ações sem corpo: corpo não-JSON → 415
  const rx = await mkBook(B);
  r = await mkReq(C, rx.id);
  const rxReq = r.json?.request;
  r = await call('POST', `/api/requests/${rxReq.id}/reject`, { token: B.token, raw: 'oi', ct: 'text/plain' });
  check('reject com corpo text/plain → 415 e pedido continua pendente', errIs(r, 415) && (await box(C, 'outgoing')).find((x) => x.id === rxReq.id)?.status === 'pendente', show(r));
  r = await call('POST', `/api/requests/${rxReq.id}/reject`, { token: B.token, raw: '{oops', ct: 'application/json' });
  check('reject com JSON inválido → 400', errIs(r, 400), show(r));
  r = await call('POST', `/api/requests/${rxReq.id}/reject`, { token: B.token, body: {} });
  check('reject com corpo {} (como o frontend envia) → 200', r.status === 200 && r.json.request.status === 'recusado', show(r));
  // ids e rotas
  for (const p of ['/api/books/abc', '/api/books/0', '/api/books/01', '/api/books/-1', '/api/books/99999999999999999999', `/api/books/1%20OR%201=1`]) {
    r = await call('GET', p);
    check(`GET ${p} → 404 JSON`, errIs(r, 404), show(r));
  }
  r = await act(B, 'abc', 'reject');
  check('POST /api/requests/abc/reject → 404', errIs(r, 404), show(r));
  r = await call('GET', '/api/nao-existe');
  check('rota /api desconhecida → 404 JSON', errIs(r, 404) && (r.headers.get('content-type') || '').includes('application/json'), show(r));
  r = await call('PUT', `/api/books/${mb.id}`, { token: B.token, body: { title: 'put' } });
  check('PUT /api/books/:id → 405 (método não exportado)', r.status === 405, show(r));
  r = await call('DELETE', '/api/books', { token: B.token });
  check('DELETE /api/books (coleção) → 405', r.status === 405, show(r));
  r = await call('GET', `/api/requests/${rxReq.id}/approve`, { token: B.token });
  check('GET em rota de ação → 405', r.status === 405, show(r));
  check('nenhuma resposta 500 vazou stack trace nesta suíte', !failures.some((f) => /at .*\.js:\d+/.test(f)));

  // ------------------------------------------------------------- 9. frontend (smoke via servidor)
  group('G9', 'Frontend (smoke)');
  r = await call('GET', '/');
  check('GET / → 200 text/html', r.status === 200 && (r.headers.get('content-type') || '').includes('text/html'), r.headers.get('content-type'));
  const footer = (r.text.match(/<footer[\s\S]*?<\/footer>/i) || [''])[0];
  check('Chave do projeto no <footer> do HTML servido', footer.includes(CHAVE), footer.slice(0, 200));
  check('HTML servido declara charset utf-8', /<meta charset="utf-8">/i.test(r.text));
  const assets = [...r.text.matchAll(/(?:src|href)="(\/[^"#?]+\.(?:js|css))"/g)].map((m) => m[1]);
  check('HTML referencia app.js e styles.css locais', assets.includes('/app.js') && assets.includes('/styles.css'), assets);
  const jsFiles = new Set(['/app.js', '/js/api.js', '/js/catalog.js', '/js/dashboard.js', '/js/state.js', '/js/ui.js']);
  for (const p of [...new Set([...assets, ...jsFiles])]) {
    const a = await call('GET', p);
    const ct = a.headers.get('content-type') || '';
    const want = p.endsWith('.css') ? /text\/css/ : /(text|application)\/javascript/;
    check(`GET ${p} → 200 ${p.endsWith('.css') ? 'text/css' : 'javascript'}`, a.status === 200 && want.test(ct), `${a.status} ${ct}`);
    if (p.endsWith('.js')) {
      for (const m of a.text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        if (m[1].startsWith('.')) jsFiles.add(new URL(m[1], BASE + p).pathname);
        else check(`${p} importa apenas módulos locais`, false, m[1]);
      }
    }
  }
}

main()
  .catch((err) => { nFail++; failures.push(`[${G}] exceção: ${err.stack || err}`); console.log(`FAIL [${G}] exceção não tratada: ${err.stack || err}`); })
  .finally(() => {
    console.log(`\nResumo: ${nPass} PASS, ${nFail} FAIL, ${nSkip} SKIP`);
    if (failures.length) { console.log('Falhas:'); for (const f of failures) console.log(`  - ${f}`); }
    process.exitCode = nFail ? 1 : 0;
  });
