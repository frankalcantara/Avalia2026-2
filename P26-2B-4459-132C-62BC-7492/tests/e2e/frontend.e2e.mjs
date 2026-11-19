// E2E do frontend (Playwright + API simulada conforme docs/API.md)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const PW_PATHS = [process.env.PLAYWRIGHT_PATH, '/opt/node-tools/node_modules', '/opt/npm-tools/node_modules', '/home/claude/.npm-global/lib/node_modules'].filter(Boolean);
let chromium;
for (const base of [undefined, ...PW_PATHS]) { try { ({ chromium } = req(base ? path.join(base, 'playwright') : 'playwright')); break; } catch {} }
if (!chromium) throw new Error('playwright nao encontrado (defina PLAYWRIGHT_PATH)');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const pub = process.env.PUBLIC_DIR ? path.resolve(process.env.PUBLIC_DIR) : path.join(root, 'public'); // PUBLIC_DIR permite validar uma copia corrigida
const shots = path.join(here, 'screenshots');
fs.mkdirSync(shots, { recursive: true });
const KEY = 'P26-2B-4459-132C-62BC-7492';
const XSS_NAME = '<img src=x onerror=window.__xss=1>';
const Q_TEXT = '<main> & "teste"';

const csp = (fs.readFileSync(path.join(pub, '_headers'), 'utf8').match(/Content-Security-Policy:\s*(.+)/) || [])[1];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(pub, p);
  if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  const h = { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' };
  if (csp) h['Content-Security-Policy'] = csp;
  res.writeHead(200, h); res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const results = [];
const rec = (id, name, ok, detail = '') => { results.push({ id, name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} [${id}] ${name}${detail ? ' -> ' + detail : ''}`); };
const consoleErrors = [], external = [], externalAllowed = new Set();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const json = (route, status, body, delay = 0) => new Promise(r => setTimeout(() => r(route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })), delay));

// ---------- API simulada ----------
function makeApi(opts = {}) {
  const S = { me: opts.me ?? 200, posts: { start: [], next: [], answer: [] }, bodies: { answer: [], start: [] }, nextPayloads: [], idx: 0, sentAt: null, score: 0, review: [] };
  const Qs = opts.questions || [
    { text: Q_TEXT, options: ['<b>a</b>', 'B & b', '"C"', 'D'], limit: 6000, correct: 1, answerResp: 'auto' },
    { text: 'Pergunta de timeout', options: ['a', 'b', 'c', 'd'], limit: 2000, correct: 0 },
    { text: 'Pergunta errada', options: ['a', 'b', 'c', 'd'], limit: 6000, correct: 2 },
    { text: 'Pergunta 408', options: ['a', 'b', 'c', 'd'], limit: 6000, correct: 3, force408: true },
  ];
  S.Qs = Qs;
  S.handler = async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method();
    let body = null; try { body = req.postDataJSON(); } catch {}
    if (p === '/api/me') return S.me === 200 ? json(route, 200, { user: { id: '1', name: XSS_NAME, avatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png' } }) : json(route, 401, { error: 'unauthenticated' });
    if (p === '/api/categories') return json(route, 200, { categories: [{ id: 'web', name: 'Web & "HTTP"', description: 'Perguntas <b>web</b>', questionCount: 4 }, { id: 'js', name: 'JavaScript', description: 'JS', questionCount: 1 }] });
    if (p === '/api/quiz/start') { S.posts.start.push(body); S.idx = 0; S.sentAt = null; S.score = 0; S.review = []; return json(route, 200, { quizId: 'q1', total: Qs.length }); }
    if (p === '/api/quiz/next') {
      S.posts.next.push(body);
      if (S.idx >= Qs.length) { const pl = { done: true, summary: { score: S.score, correctCount: S.review.filter(r => r.result === 'correct').length, total: Qs.length, accuracy: 0.25, review: S.review } }; return json(route, 200, pl); }
      const q = Qs[S.idx]; if (S.sentAt === null) S.sentAt = Date.now();
      const rem = Math.max(0, q.limit - (Date.now() - S.sentAt));
      const pl = { done: false, question: { quizId: 'q1', position: S.idx, number: S.idx + 1, total: Qs.length, text: q.text, options: q.options, timeLimitMs: q.limit, remainingMs: rem, score: S.score } };
      S.nextPayloads.push(pl); return json(route, 200, pl);
    }
    if (p === '/api/quiz/answer') {
      S.posts.answer.push(body); S.bodies.answer.push(body);
      const q = Qs[S.idx]; const elapsed = Date.now() - S.sentAt; const c = body.choice;
      let r, status = 200, pts = 0, ci = null, accepted = true;
      if (c === null) r = elapsed >= q.limit ? 'timeout' : 'skipped';
      else if (q.force408) { r = 'timeout'; status = 408; accepted = false; }
      else if (c === q.correct) { r = 'correct'; pts = 900; ci = q.correct; } else { r = 'wrong'; ci = q.correct; }
      S.score += pts;
      S.review.push({ number: S.idx + 1, text: q.text, options: q.options, correctIndex: q.correct, chosenIndex: c, result: r, points: pts, elapsedMs: elapsed });
      S.idx++; S.sentAt = null;
      return json(route, status, { accepted, result: r, correctIndex: ci, points: pts, elapsedMs: elapsed, score: S.score, answered: S.idx, total: Qs.length, finished: S.idx >= Qs.length }, 300);
    }
    if (p === '/api/ranking') return json(route, 200, { categoryId: 'web', ranking: [
      { rank: 1, name: 'Outro', avatarUrl: null, best: 9120, games: 3, isMe: false },
      { rank: 2, name: XSS_NAME, avatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png', best: 7420, games: 2, isMe: true }], me: { rank: 2, best: 7420, games: 2 } });
    if (p === '/api/auth/logout') return json(route, 200, { ok: true });
    return json(route, 404, { error: 'nf' });
  };
  return S;
}

async function newPage(browser, viewport, api) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1') { if (u.pathname.startsWith('/api/')) return api.handler(route); return route.continue(); }
    if (u.hostname === 'cdn.discordapp.com') { externalAllowed.add(u.href); return route.fulfill({ status: 200, contentType: 'image/png', body: PNG }); }
    external.push(u.href); return route.abort();
  });
  const page = await ctx.newPage(); page.setDefaultTimeout(4000);
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/status of (401|408)/.test(m.text())) consoleErrors.push('console: ' + m.text()); });
  return { ctx, page };
}
const footerOk = async (page) => { const f = page.locator('footer.foot'); return (await f.isVisible()) && (await f.innerText()).includes(KEY); };
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const soft = async (fn) => { try { await fn(); } catch {} };
const safe = async (id, name, fn) => { try { const r = await fn(); if (r !== undefined) rec(id, name, r.ok, r.detail); } catch (e) { rec(id, name, false, 'excecao: ' + e.message.split('\n')[0]); } };

const browser = await chromium.launch();
const footers = {};

// ===== 1. Login =====
await safe('1a', 'Login: 401 -> botao Entrar com Discord -> /api/auth/login', async () => {
  const api = makeApi({ me: 401 }); const { ctx, page } = await newPage(browser, { width: 1280, height: 800 }, api);
  await page.goto(BASE + '/'); const a = page.getByRole('link', { name: 'Entrar com Discord' }); await a.waitFor({ timeout: 3000 });
  const href = await a.getAttribute('href'); footers.login = await footerOk(page);
  await ctx.close(); return { ok: href === '/api/auth/login', detail: 'href=' + href };
});
await safe('1b', 'Login: ?erro=state mostra mensagem amigavel e limpa a URL', async () => {
  const api = makeApi({ me: 401 }); const { ctx, page } = await newPage(browser, { width: 1280, height: 800 }, api);
  await page.goto(BASE + '/?erro=state'); await page.locator('.alert').waitFor({ timeout: 3000 });
  const txt = await page.locator('.alert').innerText(); const url = page.url();
  await ctx.close(); return { ok: /verifica[cç][aã]o de seguran[cç]a/i.test(txt) && !url.includes('erro'), detail: `texto="${txt}" url=${url}` };
});

// ===== Fluxo principal (itens 2-8) =====
const api = makeApi(); const { ctx, page } = await newPage(browser, { width: 1280, height: 800 }, api);
await page.addInitScript(() => { try { sessionStorage.clear(); } catch {} });
await safe('3a', 'Categorias renderizam (nomes via texto, sem injecao)', async () => {
  await page.goto(BASE + '/'); await page.locator('button.cat').first().waitFor({ timeout: 3000 });
  const n = await page.locator('button.cat').count(); footers.cats = await footerOk(page);
  const t = await page.locator('button.cat').first().innerText(); const noBold = (await page.locator('button.cat b').count()) === 0;
  return { ok: n === 2 && noBold && t.includes('<b>web</b>'), detail: `n=${n}` };
});
await safe('3b', 'Clique inicia quiz: POST /api/quiz/start {categoryId}', async () => {
  await page.locator('button.cat').first().click(); await page.locator('.question').waitFor({ timeout: 3000 });
  const b = api.posts.start[0]; return { ok: b && b.categoryId === 'web' && Object.keys(b).length === 1, detail: JSON.stringify(b) };
});
await safe('2b', 'Rodape com chave no quiz', async () => { footers.quiz = await footerOk(page); });

await safe('4a', 'Quiz: barra progressbar diminui (largura e aria-valuenow)', async () => {
  const fuse = page.getByRole('progressbar');
  const m = async () => fuse.evaluate(el => ({ w: el.querySelector('.fuse-fill').getBoundingClientRect().width, now: Number(el.getAttribute('aria-valuenow')) }));
  const a = await m(); await page.waitForTimeout(2200); const b = await m();
  return { ok: b.w < a.w && b.now < a.now, detail: `t0 w=${a.w.toFixed(1)} now=${a.now}; t+2.2s w=${b.w.toFixed(1)} now=${b.now}` };
});
await safe('4b', 'Quiz: payload next sem gabarito e UI nao revela correta', async () => {
  const pl = JSON.stringify(api.nextPayloads[0]); const noKey = !/correct|answer|gabarito/i.test(pl);
  const revealed = await page.locator('.is-correct, .is-wrong').count();
  const txt = await page.locator('.question').innerText();
  const xssFree = (await page.evaluate(() => window.__xss)) === undefined && txt === Q_TEXT && (await page.locator('.opt b').count()) === 0;
  return { ok: noKey && revealed === 0 && xssFree, detail: `noKey=${noKey} revealed=${revealed} textoPergunta="${txt}"` };
});
await safe('5a', 'Responder: duplo clique rapido -> 1 POST; botoes desabilitados; body valido', async () => {
  const before = api.posts.answer.length;
  await page.locator('.opt').nth(1).dblclick({ delay: 10 });
  const disabled = await page.locator('.opt').evaluateAll(bs => bs.every(b => b.disabled));
  await page.locator('.feedback.fb-correct').waitFor({ timeout: 3000 }); await page.waitForTimeout(300);
  const n = api.posts.answer.length - before; const b = api.bodies.answer[0];
  const bodyOk = b.quizId === 'q1' && b.position === 0 && Number.isInteger(b.choice) && b.choice >= 0 && b.choice <= 3;
  return { ok: n === 1 && disabled && bodyOk, detail: `POSTs=${n} disabled=${disabled} body=${JSON.stringify(b)}` };
});
await safe('5b', 'Feedback correct (verde na escolhida)', async () => {
  const txt = await page.locator('.feedback').innerText(); const g = await page.locator('.opt.is-correct').count();
  return { ok: /Correto/.test(txt) && g === 1, detail: txt.replace(/\n/g, ' | ') };
});
await soft(async () => { await page.getByRole('button', { name: 'Próxima pergunta' }).click(); await page.getByText('Pergunta 2 de').waitFor(); });
await safe('6', 'Tempo esgotado: sem clique envia choice:null sozinho (limite 2000ms)', async () => {
  const before = api.bodies.answer.length; await page.locator('.feedback.fb-wrong, .feedback:not([hidden])').first().waitFor({ timeout: 6000 });
  const b = api.bodies.answer[before]; const txt = await page.locator('.feedback').innerText();
  return { ok: b && b.choice === null && b.position === 1 && /Tempo esgotado/.test(txt), detail: `body=${JSON.stringify(b)} feedback="${txt.split('\n')[0]}"` };
});
await soft(async () => { await page.getByRole('button', { name: 'Próxima pergunta' }).click(); await page.getByText('Pergunta 3 de').waitFor(); });
await safe('5c', 'Feedback wrong: errada em vermelho e correta destacada em verde', async () => {
  await page.locator('.opt').nth(0).click(); await page.locator('.feedback:not([hidden])').waitFor();
  const w = await page.locator('.opt.is-wrong').count(); const g = await page.locator('.opt.is-correct').evaluateAll(l => l.map(e => e.querySelector('.opt-key').textContent));
  const txt = await page.locator('.feedback .fb-title').innerText(); return { ok: w === 1 && g.length === 1 && g[0] === '3' && /errada/i.test(txt), detail: `wrong=${w} correta=${g}` };
});
await soft(async () => { await page.getByRole('button', { name: 'Próxima pergunta' }).click(); await page.getByText('Pergunta 4 de').waitFor(); });
await safe('5d', 'Feedback timeout via HTTP 408 (accepted:false)', async () => {
  await page.locator('.opt').nth(3).click(); await page.locator('.feedback:not([hidden])').waitFor();
  const txt = await page.locator('.feedback .fb-title').innerText(); const err = await page.locator('.alert').count();
  return { ok: /Tempo esgotado/.test(txt) && err === 0, detail: `titulo="${txt}" alertas=${err}` };
});
await soft(async () => { await page.getByRole('button', { name: 'Ver resultado' }).click(); await page.locator('.review').waitFor({ timeout: 3000 }); });
await safe('7a', 'Resultado com revisao (gabarito, textos sem injecao) + rodape', async () => {
  footers.result = await footerOk(page);
  const items = await page.locator('.review > li').count(); const correct = await page.locator('.rev-opt.is-correct').count();
  const first = await page.locator('.rev-text').first().innerText();
  return { ok: items === 4 && correct === 4 && first === Q_TEXT && (await page.evaluate(() => window.__xss)) === undefined, detail: `itens=${items} corretas=${correct}` };
});
await safe('7b', 'Ranking: linha isMe destacada (classe .me + fundo) e nome sem injecao', async () => {
  await page.getByRole('button', { name: 'Ver ranking' }).click(); await page.locator('table.rank').waitFor({ timeout: 3000 });
  footers.rank = await footerOk(page);
  const me = page.locator('tr.me'); const n = await me.count();
  const bg = await me.evaluate(e => getComputedStyle(e).backgroundColor); const other = await page.locator('tbody tr:not(.me)').first().evaluate(e => getComputedStyle(e.querySelector('td')).backgroundColor);
  const meBg = await me.locator('td').first().evaluate(e => getComputedStyle(e).backgroundColor);
  const nm = await me.innerText(); const inj = await page.evaluate(() => window.__xss); const injImgs = await page.locator('img[src="x"]').count();
  const hdrName = await page.locator('.who-name').innerText();
  return { ok: n === 1 && (meBg !== other || bg !== 'rgba(0, 0, 0, 0)') && nm.includes(XSS_NAME) && inj === undefined && injImgs === 0 && hdrName === XSS_NAME, detail: `me=${n} bgTR=${bg} bgTD=${meBg} outro=${other} xss=${inj}` };
});
await safe('2', 'Rodape com chave em login, categorias, quiz, resultado e ranking', async () => ({ ok: footers.login && footers.cats && footers.quiz && footers.result && footers.rank, detail: JSON.stringify(footers) }));
await ctx.close().catch(() => {});

// ===== 9/10. Responsivo + screenshots =====
async function toQuiz(vp, shot) {
  const a = makeApi({ questions: [{ text: 'Qual cabeçalho HTTP controla o cache do navegador no lado do cliente e do servidor intermediário?', options: ['Cache-Control', 'Content-Type muito longo para testar quebra de linha em telas pequenas', 'Accept', 'Host'], limit: 15000, correct: 0 }] });
  const { ctx, page } = await newPage(browser, vp, a); await page.goto(BASE + '/'); await page.locator('button.cat').first().waitFor();
  const catsOk = await noHScroll(page); await page.locator('button.cat').first().click(); await page.locator('.question').waitFor(); await page.waitForTimeout(600);
  const quizOk = await noHScroll(page); if (shot) await page.screenshot({ path: path.join(shots, shot) });
  const dims = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); await ctx.close(); return { catsOk, quizOk, dims };
}
await safe('9a', 'Responsivo 320x640: sem rolagem horizontal em categorias e quiz', async () => { const r = await toQuiz({ width: 320, height: 640 }); return { ok: r.catsOk && r.quizOk, detail: `cats=${r.catsOk} quiz=${r.quizOk} scrollW/innerW=${r.dims}` }; });
await safe('9b', 'Responsivo 1280x800: sem rolagem horizontal', async () => { const r = await toQuiz({ width: 1280, height: 800 }, 'quiz-desktop.png'); return { ok: r.catsOk && r.quizOk, detail: `cats=${r.catsOk} quiz=${r.quizOk}` }; });
await safe('10', 'Screenshots quiz-mobile.png (390x844) e quiz-desktop.png', async () => {
  await toQuiz({ width: 390, height: 844 }, 'quiz-mobile.png');
  const ok = ['quiz-mobile.png', 'quiz-desktop.png'].every(f => fs.existsSync(path.join(shots, f)) && fs.statSync(path.join(shots, f)).size > 1000);
  return { ok, detail: shots };
});

// ===== 8. Console e rede =====
rec('8a', 'Sem erros de console/pageerror (inclui CSP do _headers; 401/408 do contrato ignorados)', consoleErrors.length === 0, consoleErrors.join(' || '));
rec('8b', 'Sem requisicoes externas alem de cdn.discordapp.com', external.length === 0, `bloqueadas=${JSON.stringify(external)} cdn(permitidas)=${externalAllowed.size}`);

await browser.close(); server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\nTotal: ${results.length}, PASS: ${results.length - failed}, FAIL: ${failed}`);
process.exit(failed ? 1 : 0);
