#!/usr/bin/env node
// Auditoria estática do Projeto #24 (P26-2C-BF60-C440-6484-80FA) — não precisa de servidor.
// Uso:  node tests/audit.mjs
// Verifica: sem framework/CDN em public/, sem sinks de HTML com dado da API, chave no <footer>,
// sem text-shadow, sem rota de login falsa, SQL só com prepare+bind (interpolações auditadas),
// e que toda rota /api chamada pelo frontend existe em functions/ com o método certo.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHAVE = 'P26-2C-BF60-C440-6484-80FA';
let nPass = 0, nFail = 0;
const failures = [];
let G = '';
const group = (id, t) => { G = id; console.log(`\n=== ${id} ${t}`); };
function check(name, cond, detail) {
  if (cond) { nPass++; console.log(`PASS [${G}] ${name}`); }
  else {
    nFail++;
    const d = detail === undefined ? '' : ` :: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
    failures.push(`[${G}] ${name}${d}`);
    console.log(`FAIL [${G}] ${name}${d}`);
  }
}
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const rel = (p) => relative(ROOT, p).split(sep).join('/');
const read = (p) => readFileSync(p, 'utf8');
// Linha (1-based) de um índice no texto.
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;
// Remove comentários // e /* */ de JS (aproximação suficiente para auditoria).
const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));

const pub = walk(join(ROOT, 'public'));
const pubText = pub.filter((p) => /\.(html|js|css|mjs|json|txt)$/.test(p));

// ------------------------------------------------------------------ A1 framework/CDN
group('A1', 'Sem framework/CDN em public/');
const FRAMEWORKS = /\b(react|react-dom|vue|angular|jquery|bootstrap|tailwind|alpinejs|alpine\.js|htmx|svelte|preact|lit-html|lodash|axios|bulma|foundation)\b/i;
for (const p of pubText) {
  const t = read(p);
  const code = p.endsWith('.js') ? stripJsComments(t) : t;
  const ext = [...code.matchAll(/(?:src|href)\s*=\s*["'](https?:)?\/\/[^"']+["']/gi)].map((m) => m[0]);
  const extOk = ext.filter((e) => !/discord\.com|cdn\.discordapp\.com/.test(e));
  check(`${rel(p)}: nenhum script/estilo externo (CDN)`, extOk.length === 0, extOk);
  if (p.endsWith('.css')) check(`${rel(p)}: sem @import externo`, !/@import\s+(url\()?["']?https?:/i.test(t));
  if (p.endsWith('.js')) {
    const bare = [...code.matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]).filter((s) => !s.startsWith('.') && !s.startsWith('/'));
    check(`${rel(p)}: imports só de módulos locais`, bare.length === 0, bare);
    const fw = code.match(FRAMEWORKS);
    check(`${rel(p)}: nenhum nome de framework/biblioteca no código`, !fw, fw && fw[0]);
  }
}
check('public/ não tem node_modules nem package.json', !pub.some((p) => /node_modules|package\.json/.test(p)));
check('raiz não declara dependências de runtime de frontend', !existsSync(join(ROOT, 'package.json')) || !/"dependencies"\s*:\s*\{[^}]*\S[^}]*\}/.test(read(join(ROOT, 'package.json'))));

// ------------------------------------------------------------------ A2 sinks de HTML
group('A2', 'Sem innerHTML/outerHTML/insertAdjacentHTML');
const SINKS = /\b(innerHTML|outerHTML|insertAdjacentHTML|document\.write(ln)?|createContextualFragment|DOMParser|srcdoc)\b|\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"`]/;
for (const p of pub.filter((x) => /\.(js|html)$/.test(x))) {
  const code = p.endsWith('.js') ? stripJsComments(read(p)) : read(p);
  const m = code.match(SINKS);
  check(`${rel(p)}: nenhum sink de HTML/código`, !m, m && `${m[0]} na linha ${lineOf(code, m.index)}`);
  if (p.endsWith('.html')) check(`${rel(p)}: sem <script> inline nem on*= inline`, !/<script(?![^>]*\bsrc=)[^>]*>/i.test(code) && !/\son[a-z]+\s*=/i.test(code));
}
// el() em ui.js: atributos on* só aceitam função; href/src com dado da API precisam de controle.
const ui = read(join(ROOT, 'public/js/ui.js'));
check('ui.js el(): listeners só quando o valor é função (on* string nunca vira atributo executável)', /key\.startsWith\('on'\)\s*&&\s*typeof value === 'function'/.test(ui));
const elOnAttr = /else if \(value === true\)[^\n]*\n\s*else node\.setAttribute\(key, String\(value\)\)/.test(ui);
check('ui.js el(): demais props viram setAttribute (texto, não HTML)', elOnAttr);
check('ui.js avatar(): src só aceita https://', /\/\^https:\\\/\\\/\/i\.test\(url\)/.test(ui));
const allJs = pub.filter((p) => p.endsWith('.js')).map((p) => [p, stripJsComments(read(p))]);
for (const [p, code] of allJs) {
  const hrefs = [...code.matchAll(/href:\s*([^,}]+)/g)].map((m) => m[1].trim()).filter((v) => !/^['"`][#/]/.test(v));
  check(`${rel(p)}: todo href é literal local (sem URL vinda da API)`, hrefs.length === 0, hrefs);
}

// ------------------------------------------------------------------ A3 chave no footer
group('A3', 'Chave no <footer> estático');
const html = read(join(ROOT, 'public/index.html'));
const footer = (html.match(/<footer[\s\S]*?<\/footer>/i) || [''])[0];
check('public/index.html tem <footer>', footer.length > 0);
check(`<footer> contém ${CHAVE} em texto estático`, footer.includes(CHAVE));
check('<footer> não depende de JS (sem id preenchido por script)', !/<footer[^>]*>\s*<\/footer>/.test(footer));
check('<title> contém a chave', /<title>[^<]*P26-2C-BF60-C440-6484-80FA[^<]*<\/title>/.test(html));

// ------------------------------------------------------------------ A4 text-shadow
group('A4', 'Sem text-shadow');
for (const p of pubText) {
  const t = read(p);
  const i = t.search(/text-shadow/i);
  check(`${rel(p)}: sem text-shadow`, i < 0, i >= 0 ? `linha ${lineOf(t, i)}` : undefined);
}

// ------------------------------------------------------------------ A5 login falso
group('A5', 'Sem rota de login falsa');
const fnFiles = walk(join(ROOT, 'functions'));
const srcFiles = walk(join(ROOT, 'src'));
const backend = [...fnFiles, ...srcFiles].filter((p) => p.endsWith('.js'));
const suspicious = fnFiles.filter((p) => /(login|dev|fake|test|mock|impersonat|debug|seed|admin)/i.test(rel(p)));
check('functions/ não tem arquivo de rota de login/dev/fake/test', suspicious.length === 0, suspicious.map(rel));
const sessionInserts = backend.filter((p) => /INSERT\s+INTO\s+sessions/i.test(read(p))).map(rel);
check('só src/discord.js insere em sessions', JSON.stringify(sessionInserts) === JSON.stringify(['src/discord.js']), sessionInserts);
const upsertCallers = backend.filter((p) => /upsertUserAndCreateSession\s*\(/.test(read(p)) && !p.endsWith(`src${sep}discord.js`)).map(rel);
check('só o callback OAuth chama upsertUserAndCreateSession', JSON.stringify(upsertCallers) === JSON.stringify(['functions/api/auth/discord/callback.js']), upsertCallers);
const cb = read(join(ROOT, 'functions/api/auth/discord/callback.js'));
const iState = cb.indexOf('safeEqual(state, expected)'), iExchange = cb.indexOf('exchangeCode(');
check('callback confere state antes de trocar o code', iState > 0 && iExchange > iState);
check('callback não aceita user_id/username vindos da query', !/searchParams\.get\(['"](user_id|id|username)['"]\)/.test(cb));
const envBypass = backend.filter((p) => /env\.(DEV|DEBUG|TEST|FAKE)[A-Z_]*/.test(read(p))).map(rel);
check('nenhum atalho por variável de ambiente DEV/DEBUG/TEST', envBypass.length === 0, envBypass);

// ------------------------------------------------------------------ A6 SQL
group('A6', 'SQL só com prepare + bind');
// Cada interpolação ${...} dentro de template literal com SQL precisa estar nesta lista, com justificativa.
const ALLOWED = [
  [/^BOOK_SELECT$|^REQUEST_SELECT$/, 'constante de módulo (src/serialize.js), SQL fixo'],
  [/^userCols\("[a-z]+", "[a-z]+"\)$/, 'helper chamado só com literais'],
  [/^alias$|^prefix$/, 'parâmetros de userCols, só recebem literais'],
  [/^LIST_LIMIT$/, 'constante numérica 200'],
  [/^where\.length \? " WHERE " \+ where\.join\(" AND "\) : ""$/, 'fragmentos de where.push são literais; valores vão em binds'],
  [/^sets$/, 'nomes de coluna de Object.keys(validateBookInput()), lista fixa'],
  [/^col$/, 'ternário entre "r.owner_id"/"r.requester_id" literais'],
  [/^c$/, 'coluna dentro de cols.map (mesma origem de sets)'],
];
const SQL_KW = /\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM)\b/;
for (const p of backend) {
  const code = stripJsComments(read(p));
  for (const m of code.matchAll(/`(?:\\[\s\S]|[^`\\])*`/g)) {
    const tpl = m[0];
    if (!SQL_KW.test(tpl)) continue;
    for (const im of tpl.matchAll(/\$\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)) {
      const expr = im[1].trim();
      const ok = ALLOWED.find(([re]) => re.test(expr));
      check(`${rel(p)}:${lineOf(code, m.index + im.index)} interpolação \${${expr}} ${ok ? `(${ok[1]})` : 'NÃO justificada'}`, !!ok);
    }
  }
  check(`${rel(p)}: sem .exec() de SQL cru`, !/\.exec\s*\(/.test(code));
  const concat = [...code.matchAll(/prepare\(\s*(['"`])[^'"`]*\1\s*\+/g)];
  check(`${rel(p)}: sem concatenação + logo após prepare(`, concat.length === 0);
}
const books = read(join(ROOT, 'src/books.js'));
const pushes = [...books.matchAll(/where\.push\(([^;]*)\);/g)].map((m) => m[1]);
// Literal entre aspas duplas, sem ${ } e sem concatenação.
const isPlainLiteral = (a) => /^"(?:[^"\\]|\\.)*"$/.test(a.trim()) && !a.includes('${');
check('src/books.js: todo where.push recebe literal de string', pushes.length > 0 && pushes.every(isPlainLiteral), pushes);
check('src/books.js: sets vem de Object.keys(validateBookInput(...))', /const fields = validateBookInput\(body, \{ partial: true \}\);\s*const cols = Object\.keys\(fields\);/.test(books));
const validate = read(join(ROOT, 'src/validate.js'));
const outKeys = [...validate.matchAll(/out\.([a-z_]+)\s*=/g)].map((m) => m[1]);
check('validateBookInput só produz colunas descritivas fixas', JSON.stringify(outKeys) === JSON.stringify(['title', 'author', 'category', 'mode', 'condition', 'isbn', 'description']), outKeys);
check('validateBookInput nunca produz status/owner_id/holder_id', !outKeys.some((k) => ['status', 'owner_id', 'holder_id', 'due_date'].includes(k)));
const reqIdx = read(join(ROOT, 'functions/api/requests/index.js'));
check('requests/index.js: col é ternário de literais', /const col = box === "incoming" \? "r\.owner_id" : box === "outgoing" \? "r\.requester_id" : null;/.test(reqIdx));
const allPrepare = backend.flatMap((p) => [...stripJsComments(read(p)).matchAll(/\.prepare\(/g)].map(() => p));
const allBind = backend.reduce((n, p) => n + [...stripJsComments(read(p)).matchAll(/\)\s*\.bind\(|\.bind\(/g)].length, 0);
check(`há ${allPrepare.length} prepare() e ${allBind} bind() no backend`, allPrepare.length > 0 && allBind > 0);

// ------------------------------------------------------------------ A7 rotas do frontend existem
group('A7', 'Toda rota /api do frontend existe em functions/ com o método certo');
function routeFile(path) {
  // /api/books/:id → functions/api/books/[id].js ; /api/books → functions/api/books/index.js ou books.js
  const segs = path.replace(/^\//, '').split('/');
  const fsSegs = segs.map((s) => (s.startsWith(':') ? '[id]' : s));
  const cands = [join(ROOT, 'functions', ...fsSegs) + '.js', join(ROOT, 'functions', ...fsSegs, 'index.js')];
  return cands.find((c) => existsSync(c));
}
const calls = [];
for (const [p, code] of allJs) {
  for (const m of code.matchAll(/api\(\s*(['"`])(\/api\/[^'"`]*?)\1\s*(?:,\s*\{([^}]*)\})?/g)) {
    const method = ((m[3] || '').match(/method:\s*['"]([A-Z]+)['"]/) || [, 'GET'])[1];
    const path = m[2].replace(/\$\{encodeURIComponent\([^)]*\)\}/g, ':id').split('${')[0].split('?')[0];
    calls.push({ file: rel(p), line: lineOf(code, m.index), method, path });
  }
  for (const m of code.matchAll(/href:\s*['"](\/api\/[^'"]+)['"]/g)) calls.push({ file: rel(p), line: lineOf(code, m.index), method: 'GET', path: m[1] });
}
for (const m of html.matchAll(/href="(\/api\/[^"]+)"/g)) calls.push({ file: 'public/index.html', line: lineOf(html, m.index), method: 'GET', path: m[1] });
// runAction(…, path, …) usa POST com path montado em template: capturar também.
for (const [p, code] of allJs) {
  for (const m of code.matchAll(/runAction\([^`]*`(\/api\/[^`]+)`/g)) {
    calls.push({ file: rel(p), line: lineOf(code, m.index), method: 'POST', path: m[1].replace(/\$\{encodeURIComponent\([^)]*\)\}/g, ':id') });
  }
}
check(`frontend chama ao menos 10 rotas /api (encontradas ${calls.length})`, calls.length >= 10, calls);
const seen = new Set();
for (const c of calls) {
  const key = `${c.method} ${c.path}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const f = routeFile(c.path);
  const exportName = `onRequest${c.method[0]}${c.method.slice(1).toLowerCase()}`;
  const code = f ? read(f) : '';
  check(`${key} (${c.file}:${c.line}) → ${f ? rel(f) : 'ARQUIVO AUSENTE'} exporta ${exportName}`, !!f && (new RegExp(`export\\s+(const|async function|function)\\s+(${exportName}|onRequest)\\b`).test(code)));
}

console.log(`\nResumo: ${nPass} PASS, ${nFail} FAIL`);
if (failures.length) { console.log('Falhas:'); for (const f of failures) console.log(`  - ${f}`); }
process.exitCode = nFail ? 1 : 0;
