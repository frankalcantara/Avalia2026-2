// Testes de API contra o servidor local (wrangler pages dev + D1 local), node:test sem dependências.
// Pré-requisitos: banco local limpo preparado por tests/preparar-ambiente.sh e servidor rodando.
//   eval "$(bash tests/preparar-ambiente.sh)"
//   wrangler pages dev public --port 8788 &
//   BASE_URL=http://localhost:8788 node --test tests/api.test.mjs
// Sem TEST_TOKEN e TEST_TOKEN_2 os testes são pulados (ex.: em `node --test tests/` sem servidor).
// A resposta das partidas é descoberta só pela API (perdendo a partida com outro usuário), nunca lendo o D1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ANSWERS } from "../src/data/answers.js";
import { VALID } from "../src/data/valid.js";

const BASE = (process.env.BASE_URL || "http://localhost:8788").replace(/\/$/, "");
const T1 = process.env.TEST_TOKEN;
const T2 = process.env.TEST_TOKEN_2;
const skip = !T1 || !T2 ? "defina TEST_TOKEN e TEST_TOKEN_2 (tests/preparar-ambiente.sh)" : false;
const GUILD = "900000000000000001";

const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const answerKeys = new Set(ANSWERS.map(norm));
// Chutes válidos que nunca são resposta: garantem a derrota sem conhecer a palavra
const LOSERS = VALID.split(" ").filter((w) => !answerKeys.has(w)).filter((_, i) => i % 97 === 0);
const FEEDBACK_STATES = new Set(["correct", "present", "absent"]);

const spToday = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const TODAY = spToday();
const YESTERDAY = addDays(TODAY, -1);
const TOMORROW = addDays(TODAY, 1);

async function call(path, { token, method = "GET", body, raw, cookie, redirect = "manual" } = {}) {
  const headers = {};
  if (token) headers.Cookie = `cypher_session=${token}`;
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined), redirect });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* resposta não-JSON */ }
  return { status: res.status, data, text, headers: res.headers };
}

const guess = (token, mode, date, g) => call("/api/guess", { token, method: "POST", body: { mode, date, guess: g } });
const getGame = (token, mode, date) => call(`/api/game?mode=${mode}${date ? `&date=${date}` : ""}`, { token });

function expectError(r, status, code) {
  assert.equal(r.status, status, `status esperado ${status}, obtido ${r.status}: ${r.text}`);
  assert.equal(r.data?.error, code, `código esperado ${code}: ${r.text}`);
  assert.equal(typeof r.data?.message, "string");
  assert.ok(r.data.message.length > 0);
}

function assertGameShape(d, mode, date) {
  assert.equal(d.mode, mode);
  assert.equal(d.date, date);
  assert.equal(d.today, TODAY);
  assert.equal(d.isToday, date === TODAY);
  assert.equal(typeof d.isArchive, "boolean");
  assert.equal(d.maxAttempts, mode === "sombra" ? 10 : 6);
  assert.equal(d.wordLength, 5);
  assert.ok(["playing", "won", "lost"].includes(d.status));
  assert.ok(Array.isArray(d.attempts));
  for (const a of d.attempts) {
    assert.match(a.guess, /^[A-Z]{5}$/);
    if (mode === "sombra") {
      assert.deepEqual(Object.keys(a.feedback).sort(), ["exact", "misplaced"]);
      assert.ok(Number.isInteger(a.feedback.exact) && Number.isInteger(a.feedback.misplaced));
    } else {
      assert.equal(a.feedback.length, 5);
      assert.ok(a.feedback.every((f) => FEEDBACK_STATES.has(f)));
    }
  }
  if (d.status === "playing") assert.equal(d.answer, null);
  else assert.equal(typeof d.answer, "string");
}

// Nenhum campo pode conter a resposta enquanto a partida está em andamento (busca textual na resposta crua)
function assertNoLeak(r, answerKey) {
  assert.ok(!norm(r.text).includes(answerKey), `resposta ${answerKey} vazou: ${r.text}`);
}

// Joga até terminar com chutes que nunca são resposta; devolve a última resposta da API
async function playToLose(token, mode, date, max) {
  let last;
  for (let i = 0; i < max; i++) {
    last = await guess(token, mode, date, LOSERS[i].toLowerCase());
    assert.equal(last.status, 200, last.text);
    assertGameShape(last.data, mode, date);
    if (i < max - 1) {
      assert.equal(last.data.status, "playing");
      assert.equal(last.data.answer, null);
    }
  }
  assert.equal(last.data.status, "lost");
  assert.equal(last.data.attempts.length, max);
  return last.data;
}

const answers = {};

// ---------------------------------------------------------------- autenticação
test("401 sem cookie e com cookie forjado em todas as rotas protegidas", { skip }, async () => {
  const routes = [
    ["GET", "/api/me"], ["GET", "/api/game?mode=classico"], ["POST", "/api/guess", { mode: "classico", guess: "carro" }],
    ["GET", "/api/vaults?mode=classico"], ["GET", "/api/stats?mode=classico"], ["GET", "/api/ranking?mode=classico"],
    ["GET", "/api/challenge"], ["POST", "/api/challenge", { word: "praia" }], ["GET", "/api/challenge/AAAAAAAAAA"],
    ["POST", "/api/challenge/AAAAAAAAAA/guess", { guess: "praia" }],
  ];
  const forged = ["a".repeat(64), T1.slice(0, 63) + (T1.endsWith("0") ? "1" : "0"), "nao-hex", T1.toUpperCase() === T1 ? "x" : T1.toUpperCase()];
  for (const [method, path, body] of routes) {
    expectError(await call(path, { method, body }), 401, "unauthorized");
    for (const f of forged) expectError(await call(path, { method, body, cookie: `cypher_session=${f}` }), 401, "unauthorized");
  }
});

test("GET /api/me com sessão válida segue o contrato", { skip }, async () => {
  const r = await call("/api/me", { token: T1 });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.data).sort(), ["guilds", "launchDate", "today", "user"]);
  assert.equal(r.data.user.id, "100000000000000001");
  assert.equal(r.data.user.username, "teste1");
  assert.ok(r.data.user.avatar.startsWith("https://"));
  assert.deepEqual(r.data.guilds, [{ id: GUILD, name: "Turma Teste", icon: null }]);
  assert.equal(r.data.today, TODAY);
  assert.equal(r.data.launchDate, "2026-11-01");
  assert.equal(r.headers.get("cache-control"), "no-store");
  const r2 = await call("/api/me", { token: T2 });
  assert.deepEqual(r2.data.guilds, []);
});

test("OAuth: redireciona ao Discord com state, escopos e cookie HttpOnly; returnTo inseguro vira /", { skip }, async () => {
  const r = await call("/api/auth/discord?returnTo=//evil.example/x");
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get("location"));
  assert.equal(loc.origin, "https://discord.com");
  assert.equal(loc.searchParams.get("scope"), "identify guilds");
  assert.equal(loc.searchParams.get("response_type"), "code");
  assert.equal(loc.searchParams.get("redirect_uri"), `${BASE}/api/auth/discord/callback`);
  const state = loc.searchParams.get("state");
  assert.match(state, /^[0-9a-f]{32}$/);
  const setCookie = r.headers.get("set-cookie");
  assert.match(setCookie, /cypher_oauth=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Max-Age=600/);
  const value = JSON.parse(decodeURIComponent(setCookie.match(/cypher_oauth=([^;]+)/)[1]));
  assert.equal(value.state, state);
  assert.equal(value.returnTo, "/");
  const ok = await call("/api/auth/discord?returnTo=%2F%3Fdesafio%3DabcDEF1234");
  const v2 = JSON.parse(decodeURIComponent(ok.headers.get("set-cookie").match(/cypher_oauth=([^;]+)/)[1]));
  assert.equal(v2.returnTo, "/?desafio=abcDEF1234");
});

test("OAuth callback: state ausente ou diferente é recusado (CSRF)", { skip }, async () => {
  const r1 = await call("/api/auth/discord/callback?code=abc&state=xyz");
  assert.equal(r1.status, 302);
  assert.equal(r1.headers.get("location"), "/?auth_error=state");
  const r2 = await call("/api/auth/discord/callback?code=abc&state=xyz", { cookie: `cypher_oauth=${encodeURIComponent(JSON.stringify({ state: "outro", returnTo: "/" }))}` });
  assert.equal(r2.headers.get("location"), "/?auth_error=state");
  assert.ok(!/cypher_session=[0-9a-f]/.test(r2.headers.get("set-cookie") || ""));
  const r3 = await call("/api/auth/discord/callback?error=access_denied");
  assert.equal(r3.headers.get("location"), "/?auth_error=cancelado");
});

test("logout sem sessão responde { ok: true } e apaga o cookie", { skip }, async () => {
  const r = await call("/api/auth/logout", { method: "POST" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { ok: true });
  assert.match(r.headers.get("set-cookie"), /cypher_session=;.*Max-Age=0/);
});

// ---------------------------------------------------------------- validação de entrada
test("datas: futura → 403 future_date, antes do lançamento → 400 before_launch, inválida → 400", { skip }, async () => {
  for (const mode of ["classico", "sombra"]) {
    expectError(await getGame(T1, mode, TOMORROW), 403, "future_date");
    expectError(await getGame(T1, mode, "2099-01-01"), 403, "future_date");
    expectError(await guess(T1, mode, TOMORROW, "carro"), 403, "future_date");
    expectError(await getGame(T1, mode, "2026-10-31"), 400, "before_launch");
    expectError(await guess(T1, mode, "2026-10-31", "carro"), 400, "before_launch");
    expectError(await getGame(T1, mode, "2026-02-30"), 400, "invalid_date");
    expectError(await getGame(T1, mode, "15-11-2026"), 400, "invalid_date");
    expectError(await guess(T1, mode, 20261115, "carro"), 400, "invalid_date");
  }
});

test("modo inexistente → 400 invalid_mode (inclusive nomes de protótipo)", { skip }, async () => {
  for (const m of ["desafio", "hard", "__proto__", "constructor", "toString"]) {
    expectError(await getGame(T1, encodeURIComponent(m)), 400, "invalid_mode");
    expectError(await guess(T1, m, TODAY, "carro"), 400, "invalid_mode");
    expectError(await call(`/api/stats?mode=${m}`, { token: T1 }), 400, "invalid_mode");
    expectError(await call(`/api/vaults?mode=${m}`, { token: T1 }), 400, "invalid_mode");
    expectError(await call(`/api/ranking?mode=${m}`, { token: T1 }), 400, "invalid_mode");
  }
});

test("chute com 4/6 letras, números, símbolos ou não-texto → 400; fora do dicionário → 422; nada é gravado", { skip }, async () => {
  for (const mode of ["classico", "sombra"]) {
    for (const g of ["casa", "carros", "c4rro", "12345", "car-o", "", null, 12345, ["CARRO"], { a: 1 }]) {
      expectError(await guess(T1, mode, TODAY, g), 400, "invalid_format");
    }
    expectError(await guess(T1, mode, TODAY, "zzzzz"), 422, "not_a_word");
    expectError(await guess(T1, mode, TODAY, "qwert"), 422, "not_a_word");
    const r = await getGame(T1, mode, TODAY);
    assert.equal(r.status, 200);
    assert.equal(r.data.attempts.length, 0, "chute inválido não pode consumir tentativa");
  }
  expectError(await call("/api/guess", { token: T1, method: "POST", raw: "{nao-json", body: undefined }), 400, "invalid_format");
  expectError(await call("/api/guess", { token: T1, method: "POST", raw: "[1,2]" }), 400, "invalid_format");
});

test("método não permitido → 405 JSON", { skip }, async () => {
  const r = await call("/api/game?mode=classico", { token: T1, method: "DELETE" });
  assert.equal(r.status, 405);
  assert.equal(r.data.error, "method_not_allowed");
  const r2 = await call("/api/guess", { token: T1 });
  assert.equal(r2.status, 405);
});

// ---------------------------------------------------------------- jogo diário
test("GET /api/game segue o contrato e não cria partida", { skip }, async () => {
  for (const mode of ["classico", "sombra"]) {
    const r = await getGame(T1, mode);
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.data).sort(),
      ["answer", "attempts", "date", "isArchive", "isToday", "maxAttempts", "mode", "status", "today", "wordLength"]);
    assertGameShape(r.data, mode, TODAY);
    assert.equal(r.data.isArchive, false);
    const old = await getGame(T1, mode, "2026-11-03");
    assert.equal(old.data.isArchive, true);
    assert.equal(old.data.isToday, false);
  }
  const v = await call("/api/vaults?mode=classico", { token: T1 });
  assert.ok(v.data.days.every((d) => d.status === "untouched"), "GET não pode criar partida");
});

test("clássico até perder (usuário 2, hoje): resposta só no fim, 7º chute → 409 game_over", { skip }, async () => {
  const d = await playToLose(T2, "classico", TODAY, 6);
  assert.ok(answerKeys.has(norm(d.answer)), "answer deve ser uma resposta da lista, na forma de exibição");
  assert.equal(d.answer, d.answer.toUpperCase());
  answers.classicoHoje = norm(d.answer);
  expectError(await guess(T2, "classico", TODAY, LOSERS[10]), 409, "game_over");
  const again = await getGame(T2, "classico", TODAY);
  assert.equal(again.data.status, "lost");
  assert.equal(again.data.answer, d.answer);
  assert.equal(again.data.attempts.length, 6);
});

test("sombra até perder (usuário 2, hoje): feedback por contagem, 11º chute → 409 game_over", { skip }, async () => {
  const d = await playToLose(T2, "sombra", TODAY, 10);
  answers.sombraHoje = norm(d.answer);
  assert.notEqual(answers.sombraHoje, answers.classicoHoje, "sombra e clássico devem ter palavras diferentes");
  expectError(await guess(T2, "sombra", TODAY, LOSERS[20]), 409, "game_over");
});

test("clássico até ganhar (usuário 1, hoje): sem vazamento enquanto joga, recarregar mantém tentativas", { skip }, async () => {
  const ans = answers.classicoHoje;
  assert.ok(ans, "depende do teste de derrota do usuário 2");
  for (let i = 0; i < 3; i++) {
    const r = await guess(T1, "classico", TODAY, LOSERS[30 + i]);
    assert.equal(r.status, 200);
    assertGameShape(r.data, "classico", TODAY);
    assert.equal(r.data.status, "playing");
    assertNoLeak(r, ans);
    const reload = await getGame(T1, "classico", TODAY);
    assertNoLeak(reload, ans);
    assert.equal(reload.data.attempts.length, i + 1, "recarregar não pode reiniciar a partida");
    assert.deepEqual(reload.data.attempts, r.data.attempts);
    for (const p of ["/api/vaults?mode=classico", "/api/stats?mode=classico", "/api/ranking?mode=classico", "/api/me"]) {
      assertNoLeak(await call(p, { token: T1 }), ans);
    }
  }
  // chute com acento e caixa mista é normalizado
  const display = ANSWERS.find((w) => norm(w) === ans);
  const win = await guess(T1, "classico", TODAY, display.toLowerCase());
  assert.equal(win.status, 200);
  assert.equal(win.data.status, "won");
  assert.equal(win.data.answer, display);
  assert.equal(win.data.attempts.length, 4);
  assert.deepEqual(win.data.attempts[3].feedback, Array(5).fill("correct"));
  expectError(await guess(T1, "classico", TODAY, LOSERS[40]), 409, "game_over");
});

test("sombra até ganhar (usuário 1, hoje): sem vazamento enquanto joga", { skip }, async () => {
  const ans = answers.sombraHoje;
  for (let i = 0; i < 2; i++) {
    const r = await guess(T1, "sombra", TODAY, LOSERS[50 + i]);
    assert.equal(r.data.status, "playing");
    assertNoLeak(r, ans);
    assertNoLeak(await getGame(T1, "sombra", TODAY), ans);
  }
  const win = await guess(T1, "sombra", TODAY, ans);
  assert.equal(win.data.status, "won");
  assert.deepEqual(win.data.attempts[2].feedback, { exact: 5, misplaced: 0 });
  assert.equal(norm(win.data.answer), ans);
});

test("estatísticas e ranking após as partidas do dia", { skip }, async () => {
  const s1 = await call("/api/stats?mode=classico", { token: T1 });
  assert.deepEqual(s1.data, { mode: "classico", played: 1, wins: 1, winRate: 100, currentStreak: 1, maxStreak: 1,
    distribution: [0, 0, 0, 1, 0, 0], archive: { played: 0, wins: 0 } });
  const s1s = await call("/api/stats?mode=sombra", { token: T1 });
  assert.equal(s1s.data.distribution.length, 10);
  assert.equal(s1s.data.distribution[2], 1);
  const s2 = await call("/api/stats?mode=classico", { token: T2 });
  assert.deepEqual(s2.data, { mode: "classico", played: 1, wins: 0, winRate: 0, currentStreak: 0, maxStreak: 0,
    distribution: [0, 0, 0, 0, 0, 0], archive: { played: 0, wins: 0 } });

  const g = await call("/api/ranking?mode=classico&scope=global&sort=wins", { token: T1 });
  assert.equal(g.status, 200);
  assert.equal(g.data.mode, "classico");
  assert.equal(g.data.scope, "global");
  assert.equal(g.data.guild, null);
  assert.equal(g.data.sort, "wins");
  assert.equal(g.data.me, null);
  assert.equal(g.data.entries.length, 2);
  const [e1, e2] = g.data.entries;
  assert.deepEqual(Object.keys(e1).sort(), ["avatar", "avgAttempts", "currentStreak", "isMe", "maxStreak", "played", "rank", "userId", "username", "wins"]);
  assert.deepEqual([e1.rank, e1.userId, e1.wins, e1.played, e1.avgAttempts, e1.currentStreak, e1.isMe], [1, "100000000000000001", 1, 1, 4, 1, true]);
  assert.deepEqual([e2.rank, e2.userId, e2.wins, e2.isMe], [2, "100000000000000002", 0, false]);
  const gs = await call("/api/ranking?mode=sombra&scope=global&sort=streak", { token: T2 });
  assert.equal(gs.data.sort, "streak");
  assert.equal(gs.data.entries[0].userId, "100000000000000001");
  assert.equal(gs.data.entries[1].isMe, true);
});

test("ranking de guild: membro vê só os membros; não membro → 403; parâmetros inválidos → 400", { skip }, async () => {
  const r = await call(`/api/ranking?mode=classico&scope=guild&guild=${GUILD}`, { token: T1 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.guild, { id: GUILD, name: "Turma Teste" });
  assert.deepEqual(r.data.entries.map((e) => e.userId), ["100000000000000001"]);
  expectError(await call(`/api/ranking?mode=classico&scope=guild&guild=${GUILD}`, { token: T2 }), 403, "forbidden");
  expectError(await call("/api/ranking?mode=classico&scope=guild&guild=123", { token: T1 }), 403, "forbidden");
  expectError(await call("/api/ranking?mode=classico&scope=guild", { token: T1 }), 400, "invalid_format");
  expectError(await call("/api/ranking?mode=classico&scope=guild&guild=1%20OR%201=1", { token: T1 }), 400, "invalid_format");
  expectError(await call("/api/ranking?mode=classico&scope=mundo", { token: T1 }), 400, "invalid_format");
});

test("cofre antigo não altera streak nem ranking e conta em archive", { skip }, async () => {
  // usuário 2 perde o cofre de ontem e revela a palavra; usuário 1 ganha esse cofre antigo
  const lost = await playToLose(T2, "classico", YESTERDAY, 6);
  assert.equal(lost.isArchive, true);
  const ans = norm(lost.answer);
  const before = await call("/api/ranking?mode=classico&scope=global", { token: T1 });
  const r1 = await guess(T1, "classico", YESTERDAY, LOSERS[60]);
  assert.equal(r1.data.isArchive, true);
  assertNoLeak(r1, ans);
  const win = await guess(T1, "classico", YESTERDAY, ans);
  assert.equal(win.data.status, "won");
  const s1 = await call("/api/stats?mode=classico", { token: T1 });
  assert.equal(s1.data.played, 1, "cofre antigo não pode contar em played");
  assert.equal(s1.data.wins, 1);
  assert.equal(s1.data.currentStreak, 1, "vitória em cofre antigo (ontem) não pode virar streak 2");
  assert.equal(s1.data.maxStreak, 1);
  assert.deepEqual(s1.data.distribution, [0, 0, 0, 1, 0, 0]);
  assert.deepEqual(s1.data.archive, { played: 1, wins: 1 });
  const s2 = await call("/api/stats?mode=classico", { token: T2 });
  assert.equal(s2.data.played, 1);
  assert.deepEqual(s2.data.archive, { played: 1, wins: 0 });
  const after = await call("/api/ranking?mode=classico&scope=global", { token: T1 });
  assert.deepEqual(after.data.entries, before.data.entries, "cofre antigo não pode alterar o ranking");
});

test("cofres: formato, ordem decrescente e status por dia", { skip }, async () => {
  const r = await call("/api/vaults?mode=classico", { token: T1 });
  assert.equal(r.status, 200);
  assert.equal(r.data.mode, "classico");
  assert.equal(r.data.launchDate, "2026-11-01");
  assert.equal(r.data.today, TODAY);
  const days = r.data.days;
  const expectedLen = Math.round((Date.parse(TODAY) - Date.parse("2026-11-01")) / 86400000) + 1;
  assert.equal(days.length, expectedLen);
  assert.equal(days[0].date, TODAY);
  assert.equal(days.at(-1).date, "2026-11-01");
  for (let i = 1; i < days.length; i++) assert.ok(days[i - 1].date > days[i].date);
  for (const d of days) assert.deepEqual(Object.keys(d).sort(), ["attempts", "date", "isArchive", "status"]);
  assert.deepEqual(days[0], { date: TODAY, status: "won", attempts: 4, isArchive: false });
  assert.deepEqual(days[1], { date: YESTERDAY, status: "won", attempts: 2, isArchive: true });
  assert.ok(days.slice(2).every((d) => d.status === "untouched" && d.attempts === 0 && d.isArchive));
  const r2 = await call("/api/vaults?mode=sombra", { token: T2 });
  assert.equal(r2.data.days[0].status, "lost");
  assert.equal(r2.data.days[0].attempts, 10);
  // partida em andamento aparece como playing
  await guess(T1, "sombra", "2026-11-01", LOSERS[70]);
  const r3 = await call("/api/vaults?mode=sombra", { token: T1 });
  assert.deepEqual(r3.data.days.at(-1), { date: "2026-11-01", status: "playing", attempts: 1, isArchive: true });
});

test("chutes simultâneos na mesma partida não duplicam tentativa", { skip }, async () => {
  const date = "2026-11-05";
  const results = await Promise.all([0, 1, 2, 3].map((i) => guess(T2, "sombra", date, LOSERS[80 + i])));
  const ok = results.filter((r) => r.status === 200).length;
  for (const r of results) assert.ok([200, 409].includes(r.status), `status inesperado ${r.status}: ${r.text}`);
  const g = await getGame(T2, "sombra", date);
  assert.equal(g.data.attempts.length, ok, "tentativas gravadas devem bater com as respostas 200");
  assert.ok(ok >= 1);
});

// ---------------------------------------------------------------- desafio
const ch = {};

test("desafio: criar (validação), listar e visão do criador", { skip }, async () => {
  expectError(await call("/api/challenge", { token: T1, method: "POST", body: { word: "zzzzz" } }), 422, "not_a_word");
  expectError(await call("/api/challenge", { token: T1, method: "POST", body: { word: "abc" } }), 400, "invalid_format");
  expectError(await call("/api/challenge", { token: T1, method: "POST", body: {} }), 400, "invalid_format");
  const c = await call("/api/challenge", { token: T1, method: "POST", body: { word: "praia" } });
  assert.ok([200, 201].includes(c.status), c.text);
  assert.match(c.data.id, /^[A-Za-z0-9]{10}$/);
  assert.equal(c.data.url, `/d/${c.data.id}`);
  ch.win = c.data.id;
  const c2 = await call("/api/challenge", { token: T1, method: "POST", body: { word: "limão" } });
  ch.lose = c2.data.id;

  const list = await call("/api/challenge", { token: T1 });
  assert.equal(list.status, 200);
  const item = list.data.challenges.find((x) => x.id === ch.win);
  assert.deepEqual(Object.keys(item).sort(), ["createdAt", "id", "plays", "wins", "word"]);
  assert.equal(item.word, "PRAIA");
  assert.equal(list.data.challenges.find((x) => x.id === ch.lose).word, "LIMÃO");
  assert.equal(item.plays, 0);

  const v = await call(`/api/challenge/${ch.win}`, { token: T1 });
  assert.equal(v.data.isCreator, true);
  assert.equal(v.data.word, "PRAIA");
  assert.equal(v.data.creator.username, "teste1");
  assert.deepEqual(v.data.plays, []);
});

test("desafio: criador jogando o próprio desafio → 403 own_challenge", { skip }, async () => {
  expectError(await call(`/api/challenge/${ch.win}/guess`, { token: T1, method: "POST", body: { guess: "praia" } }), 403, "own_challenge");
  expectError(await call(`/api/challenge/${ch.win}/guess`, { token: T1, method: "POST", body: { guess: "carro" } }), 403, "own_challenge");
});

test("desafio: jogador não vê a palavra até terminar, ganha e depois 409", { skip }, async () => {
  const v = await call(`/api/challenge/${ch.win}`, { token: T2 });
  assert.equal(v.status, 200);
  assert.deepEqual(Object.keys(v.data).sort(), ["answer", "attempts", "creator", "id", "isCreator", "maxAttempts", "status", "wordLength"]);
  assert.equal(v.data.isCreator, false);
  assert.deepEqual(v.data.creator, { username: "teste1", avatar: "https://cdn.discordapp.com/embed/avatars/1.png" });
  assert.equal(v.data.maxAttempts, 6);
  assert.equal(v.data.wordLength, 5);
  assert.equal(v.data.status, "playing");
  assert.equal(v.data.answer, null);
  assertNoLeak(v, "PRAIA");
  expectError(await call(`/api/challenge/${ch.win}/guess`, { token: T2, method: "POST", body: { guess: "zzzzz" } }), 422, "not_a_word");
  expectError(await call(`/api/challenge/${ch.win}/guess`, { token: T2, method: "POST", body: { guess: "pra" } }), 400, "invalid_format");
  const g1 = await call(`/api/challenge/${ch.win}/guess`, { token: T2, method: "POST", body: { guess: "carro" } });
  assert.equal(g1.data.status, "playing");
  assert.equal(g1.data.attempts.length, 1);
  assertNoLeak(g1, "PRAIA");
  assertNoLeak(await call(`/api/challenge/${ch.win}`, { token: T2 }), "PRAIA");
  const g2 = await call(`/api/challenge/${ch.win}/guess`, { token: T2, method: "POST", body: { guess: "PRAIA" } });
  assert.equal(g2.data.status, "won");
  assert.equal(g2.data.answer, "PRAIA");
  assert.deepEqual(g2.data.attempts[1].feedback, Array(5).fill("correct"));
  expectError(await call(`/api/challenge/${ch.win}/guess`, { token: T2, method: "POST", body: { guess: "carro" } }), 409, "game_over");
});

test("desafio: jogador perde em 6, resposta com acento no fim, 7º → 409", { skip }, async () => {
  let last;
  for (let i = 0; i < 6; i++) {
    last = await call(`/api/challenge/${ch.lose}/guess`, { token: T2, method: "POST", body: { guess: LOSERS[90 + i] } });
    assert.equal(last.status, 200);
    if (i < 5) assertNoLeak(last, "LIMAO");
  }
  assert.equal(last.data.status, "lost");
  assert.equal(last.data.answer, "LIMÃO");
  expectError(await call(`/api/challenge/${ch.lose}/guess`, { token: T2, method: "POST", body: { guess: "carro" } }), 409, "game_over");
});

test("desafio: criador vê quem jogou; lista mostra plays/wins; id inexistente → 404", { skip }, async () => {
  const v = await call(`/api/challenge/${ch.win}`, { token: T1 });
  assert.equal(v.data.plays.length, 1);
  assert.deepEqual(v.data.plays[0], { username: "teste2", avatar: "https://cdn.discordapp.com/embed/avatars/2.png", status: "won", attempts: 2 });
  const list = await call("/api/challenge", { token: T1 });
  const w = list.data.challenges.find((x) => x.id === ch.win);
  const l = list.data.challenges.find((x) => x.id === ch.lose);
  assert.deepEqual([w.plays, w.wins, l.plays, l.wins], [1, 1, 1, 0]);
  expectError(await call("/api/challenge/AAAAAAAAAA", { token: T1 }), 404, "not_found");
  expectError(await call("/api/challenge/curto", { token: T1 }), 404, "not_found");
  expectError(await call("/api/challenge/AAAAAAAAAA/guess", { token: T2, method: "POST", body: { guess: "carro" } }), 404, "not_found");
});

test("desafio: limite de 20 por usuário por dia → 429 rate_limited", { skip }, async () => {
  for (let i = 0; i < 20; i++) {
    const r = await call("/api/challenge", { token: T2, method: "POST", body: { word: "carro" } });
    assert.ok([200, 201].includes(r.status), `criação ${i + 1}: ${r.text}`);
  }
  expectError(await call("/api/challenge", { token: T2, method: "POST", body: { word: "carro" } }), 429, "rate_limited");
});

// ---------------------------------------------------------------- páginas públicas e Open Graph
test("/d/:id público: meta OG absolutas, título com o criador, sem revelar a palavra", { skip }, async () => {
  const r = await call(`/d/${ch.win}`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/html/);
  assert.ok(r.text.includes('content="teste1 te desafiou a abrir um cofre no Cypher"'), r.text);
  assert.ok(r.text.includes(`<meta property="og:image" content="${BASE}/og-desafio.png">`), "og:image deve ser absoluta");
  assert.ok(r.text.includes(`<meta property="og:url" content="${BASE}/d/${ch.win}">`), "og:url deve ser absoluta");
  assert.ok(r.text.includes(`<meta name="twitter:image" content="${BASE}/og-desafio.png">`));
  assert.ok(r.text.includes('name="twitter:card" content="summary_large_image"'));
  assert.ok(r.text.includes(`/?desafio=${ch.win}`));
  assert.ok(!norm(r.text).includes("PRAIA"), "a página pública não pode revelar a palavra");
  const bad = await call("/d/<script>");
  assert.equal(bad.status, 200);
  assert.ok(!bad.text.includes("<script>location.replace(\"/?desafio=<script>"));
  const img = await call("/og-desafio.png");
  assert.equal(img.status, 200);
});

test("/ público: og:image absoluta, twitter:card e chave no rodapé", { skip }, async () => {
  const r = await call("/");
  assert.equal(r.status, 200);
  assert.ok(r.text.includes(`<meta property="og:image" content="${BASE}/og.png">`), "og:image deve ser absoluta");
  assert.ok(r.text.includes(`<meta property="og:url" content="${BASE}/">`));
  assert.ok(r.text.includes('<meta name="twitter:card" content="summary_large_image">'));
  assert.ok(/<footer[\s\S]*P26-3A-0CED-4ACD-47F7-EDA9[\s\S]*<\/footer>/.test(r.text));
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  const img = await fetch(`${BASE}/og.png`);
  assert.equal(img.status, 200);
  assert.match(img.headers.get("content-type"), /image\/png/);
});
