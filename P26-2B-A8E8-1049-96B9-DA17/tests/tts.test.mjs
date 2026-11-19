// POST /api/tts: SQLite real (node:sqlite) com migrations 0001-0005, Google e cache simulados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { signSession } from "../functions/_lib/session.js";
import * as me from "../functions/api/me.js";
import * as route from "../functions/api/tts.js";
import { handleTts } from "../functions/_lib/tts.js";

const ORIGIN = "https://acervo.example";
const SECRET = "segredo-de-teste";
const KEY = "CHAVE-FALSA-123";
const dir = new URL("../migrations/", import.meta.url);
const MP3 = Uint8Array.from([0x49, 0x44, 0x33, 1, 2, 3, 250, 255]);
const B64 = Buffer.from(MP3).toString("base64");

function d1(db) {
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: (sql) => stmt(sql) };
}
function mk(extra = {}) {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(dir).sort()) db.exec(readFileSync(new URL(f, dir), "utf8"));
  return { db, env: { DB: d1(db), SESSION_SECRET: SECRET, GOOGLE_TTS_API_KEY: KEY, ...extra } };
}
function mkCache() {
  const m = new Map();
  return {
    m,
    match: async (r) => { const v = m.get(r.url); return v ? v.clone() : undefined; },
    put: async (r, res) => { m.set(r.url, res); },
  };
}
function mkFetch(impl) {
  const f = async (url, init) => { f.calls.push({ url, init }); return impl ? impl(url, init) : Response.json({ audioContent: B64 }); };
  f.calls = [];
  return f;
}
const cookie = async (id = "U1") => `discord_session=${await signSession({ userId: id, username: id, avatar: null }, SECRET)}`;
const req = async ({ body = { text: "Olá mundo", lang: "pt" }, method = "POST", origin = ORIGIN, ct = "application/json", user = "U1", auth = true } = {}) =>
  new Request(ORIGIN + "/api/tts", {
    method,
    headers: { ...(auth ? { Cookie: await cookie(user) } : {}), ...(origin ? { Origin: origin } : {}), ...(ct ? { "Content-Type": ct } : {}) },
    body: method === "GET" ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
const call = async (env, deps, opts) => handleTts({ request: await req(opts), env }, deps);
const usage = (db, p) => db.prepare("SELECT chars FROM tts_usage WHERE period = ?").get(p)?.chars ?? 0;
const dayKey = (u = "U1") => `u:${u}:${new Date().toISOString().slice(0, 10)}`;
const monthKey = () => `m:${new Date().toISOString().slice(0, 7)}`;

test("tts: 405, 403, 401, 415", async () => {
  const { env } = mk();
  const deps = { cache: mkCache(), fetchFn: mkFetch() };
  assert.equal((await call(env, deps, { method: "GET" })).status, 405);
  assert.equal((await call(env, deps, { origin: "https://evil.com" })).status, 403);
  assert.equal((await call(env, deps, { auth: false })).status, 401);
  assert.equal((await call(env, deps, { ct: "text/plain" })).status, 415);
  assert.equal(deps.fetchFn.calls.length, 0);
});

test("tts: validação (texto, lang, rate)", async () => {
  const { env } = mk();
  const deps = { cache: mkCache(), fetchFn: mkFetch() };
  const cases = [
    [{ text: "   ", lang: "pt" }, "text"],
    [{ text: 5, lang: "pt" }, "text"],
    [{ lang: "pt" }, "text"],
    [{ text: "a".repeat(1501), lang: "pt" }, "text"],
    [{ text: "oi", lang: "fr" }, "lang"],
    [{ text: "oi" }, "lang"],
    [{ text: "oi", lang: "pt", rate: 0.5 }, "rate"],
    [{ text: "oi", lang: "pt", rate: 2 }, "rate"],
    [{ text: "oi", lang: "pt", rate: "1" }, "rate"],
  ];
  for (const [body, field] of cases) {
    const r = await call(env, deps, { body });
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 40));
    const j = await r.json();
    assert.equal(j.ok, false);
    assert.ok(j.fields[field]);
  }
  assert.equal(deps.fetchFn.calls.length, 0);
});

test("tts: sem chave => 503 tts_unconfigured", async () => {
  for (const k of [undefined, "", "  "]) {
    const { env } = mk({ GOOGLE_TTS_API_KEY: k });
    const r = await call(env, { cache: mkCache(), fetchFn: mkFetch() });
    assert.equal(r.status, 503);
    assert.deepEqual(await r.json(), { ok: false, error: "Voz em nuvem não configurada.", code: "tts_unconfigured" });
  }
});

test("tts: sucesso (MISS) chama o Google com chave no header, voz certa e devolve audio/mpeg", async () => {
  const { db, env } = mk();
  const f = mkFetch();
  const r = await call(env, { cache: mkCache(), fetchFn: f }, { body: { text: "  Olá   mundo ", lang: "pt", rate: 1.256 } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Content-Type"), "audio/mpeg");
  assert.equal(r.headers.get("Cache-Control"), "private, max-age=86400");
  assert.equal(r.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(r.headers.get("X-TTS-Cache"), "MISS");
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), MP3);
  assert.equal(f.calls.length, 1);
  const { url, init } = f.calls[0];
  assert.equal(url, "https://texttospeech.googleapis.com/v1/text:synthesize");
  assert.ok(!url.includes(KEY) && !url.includes("key="));
  assert.equal(init.headers["X-Goog-Api-Key"], KEY);
  assert.deepEqual(JSON.parse(init.body), {
    input: { text: "Olá mundo" },
    voice: { languageCode: "pt-BR", name: "pt-BR-Neural2-A" },
    audioConfig: { audioEncoding: "MP3", speakingRate: 1.26, sampleRateHertz: 24000 },
  });
  assert.equal(usage(db, dayKey()), 9);
  assert.equal(usage(db, monthKey()), 9);
});

test("tts: inglês usa en-US e override por env só se válido", async () => {
  let f = mkFetch();
  await call(mk().env, { cache: mkCache(), fetchFn: f }, { body: { text: "Hello", lang: "en" } });
  assert.deepEqual(JSON.parse(f.calls[0].init.body).voice, { languageCode: "en-US", name: "en-US-Neural2-F" });
  assert.equal(JSON.parse(f.calls[0].init.body).audioConfig.speakingRate, 1);
  f = mkFetch();
  await call(mk({ TTS_VOICE_EN: "en-GB-Neural2-A" }).env, { cache: mkCache(), fetchFn: f }, { body: { text: "Hello", lang: "en" } });
  assert.deepEqual(JSON.parse(f.calls[0].init.body).voice, { languageCode: "en-GB", name: "en-GB-Neural2-A" });
  f = mkFetch();
  await call(mk({ TTS_VOICE_PT: "x; drop" }).env, { cache: mkCache(), fetchFn: f });
  assert.equal(JSON.parse(f.calls[0].init.body).voice.name, "pt-BR-Neural2-A");
});

test("tts: cache HIT não chama o Google nem conta cota", async () => {
  const { db, env } = mk();
  const deps = { cache: mkCache(), fetchFn: mkFetch() };
  await call(env, deps);
  const r = await call(env, deps, { user: "OUTRO" });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("X-TTS-Cache"), "HIT");
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), MP3);
  assert.equal(deps.fetchFn.calls.length, 1);
  assert.equal(usage(db, monthKey()), 9);
  assert.equal(usage(db, dayKey("OUTRO")), 0);
  // rate diferente = outra chave de cache
  await call(env, deps, { body: { text: "Olá mundo", lang: "pt", rate: 1.2 } });
  assert.equal(deps.fetchFn.calls.length, 2);
});

test("tts: estouro da cota diária => 429 sem chamar o Google", async () => {
  const { db, env } = mk({ TTS_DAILY_USER_CHARS: "10" });
  const deps = { cache: mkCache(), fetchFn: mkFetch() };
  assert.equal((await call(env, deps, { body: { text: "123456", lang: "pt" } })).status, 200);
  const r = await call(env, deps, { body: { text: "abcdef", lang: "pt" } });
  assert.equal(r.status, 429);
  assert.equal((await r.json()).code, "tts_quota");
  assert.equal(deps.fetchFn.calls.length, 1);
  assert.equal(usage(db, dayKey()), 6);
  assert.equal(usage(db, monthKey()), 6);
  // outro usuário ainda pode
  assert.equal((await call(env, deps, { body: { text: "abcdef", lang: "pt" }, user: "U2" })).status, 200);
});

test("tts: estouro da cota mensal => 429, sem Google, e devolve a reserva diária", async () => {
  const { db, env } = mk({ TTS_MONTHLY_CHARS: "8" });
  const deps = { cache: mkCache(), fetchFn: mkFetch() };
  assert.equal((await call(env, deps, { body: { text: "12345", lang: "pt" } })).status, 200);
  const r = await call(env, deps, { body: { text: "abcdef", lang: "pt" }, user: "U2" });
  assert.equal(r.status, 429);
  assert.equal((await r.json()).code, "tts_quota");
  assert.equal(deps.fetchFn.calls.length, 1);
  assert.equal(usage(db, monthKey()), 5);
  assert.equal(usage(db, dayKey("U2")), 0);
});

test("tts: falha do Google => 502 sem vazar corpo e reserva devolvida", async () => {
  const { db, env } = mk();
  for (const impl of [
    () => new Response("segredo do google " + KEY, { status: 403 }),
    () => Response.json({ semAudio: true }),
    () => { throw new Error("rede"); },
  ]) {
    const r = await call(env, { cache: mkCache(), fetchFn: mkFetch(impl) });
    assert.equal(r.status, 502);
    const t = await r.text();
    assert.deepEqual(JSON.parse(t), { ok: false, error: "Falha ao gerar a voz.", code: "tts_upstream" });
    assert.ok(!t.includes("google") && !t.includes(KEY));
    assert.equal(usage(db, dayKey()), 0);
    assert.equal(usage(db, monthKey()), 0);
  }
});

test("tts: timeout aborta a chamada ao Google => 502", async () => {
  const { env } = mk();
  const f = mkFetch((_u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new Error("abort")))));
  const real = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...a) => real(fn, ms === 8000 ? 5 : ms, ...a);
  try {
    const r = await call(env, { cache: mkCache(), fetchFn: f });
    assert.equal(r.status, 502);
  } finally { globalThis.setTimeout = real; }
});

test("rota /api/tts exporta onRequest e responde 401 sem sessão", async () => {
  const { env } = mk();
  const r = await route.onRequest({ request: await req({ auth: false }), env });
  assert.equal(r.status, 401);
});

test("/api/me: tts true/false conforme a chave", async () => {
  const getMe = async (env) =>
    (await me.onRequest({ request: new Request(ORIGIN + "/api/me", { headers: { Cookie: await cookie("A") } }), env })).json();
  const a = mk();
  a.db.prepare("INSERT INTO discord_users (user_id, username) VALUES ('A','A')").run();
  const j = await getMe(a.env);
  assert.equal(j.tts, true);
  assert.ok(!JSON.stringify(j).includes(KEY));
  for (const k of [undefined, "", "  "]) assert.equal((await getMe(mk({ GOOGLE_TTS_API_KEY: k }).env)).tts, false);
});
