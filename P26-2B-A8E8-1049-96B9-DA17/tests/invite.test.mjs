// Convite ao servidor do Discord: SQLite real (node:sqlite) com as migrations 0001-0004.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { signSession } from "../functions/_lib/session.js";
import * as me from "../functions/api/me.js";
import * as prompt from "../functions/api/discord/invite-prompt.js";

const ORIGIN = "https://acervo.example";
const SECRET = "segredo-de-teste";
const INVITE = "https://discord.gg/jkbgdFP7c9";
const dir = new URL("../migrations/", import.meta.url);

function d1(db) {
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: (sql) => stmt(sql) };
}
function mk(extra = {}, upTo = 4) {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(dir).sort().slice(0, upTo)) db.exec(readFileSync(new URL(f, dir), "utf8"));
  return { db, env: { DB: d1(db), SESSION_SECRET: SECRET, DISCORD_INVITE_URL: INVITE, ...extra } };
}
const addUser = (db, id) => db.prepare("INSERT INTO discord_users (user_id, username) VALUES (?, ?)").run(id, id);
const cookie = async (id) => `discord_session=${await signSession({ userId: id, username: id, avatar: null }, SECRET)}`;
const getMe = async (env, c) =>
  me.onRequest({ request: new Request(ORIGIN + "/api/me", { headers: c ? { Cookie: c } : {} }), env });
const postPrompt = (env, c, body, { origin = ORIGIN, method = "POST", ct = "application/json" } = {}) =>
  prompt.onRequest({
    request: new Request(ORIGIN + "/api/discord/invite-prompt", {
      method,
      headers: { ...(c ? { Cookie: c } : {}), ...(origin ? { Origin: origin } : {}), ...(ct ? { "Content-Type": ct } : {}) },
      body: method === "GET" ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
  });

test("migration 0004 aplica após 0001-0003 e faz backfill dos existentes", async () => {
  const { db, env } = mk({}, 3);
  addUser(db, "old");
  db.exec(readFileSync(new URL("0004_invite_prompt.sql", dir), "utf8"));
  addUser(db, "new");
  assert.ok(db.prepare("SELECT invite_prompt_seen_at AS s FROM discord_users WHERE user_id='old'").get().s);
  assert.equal(db.prepare("SELECT invite_prompt_seen_at AS s FROM discord_users WHERE user_id='new'").get().s, null);
  assert.equal((await (await getMe(env, await cookie("old"))).json()).invitePrompt.show, false);
  assert.equal((await (await getMe(env, await cookie("new"))).json()).invitePrompt.show, true);
});

test("/api/me: sem sessão 401; novo usuário show=true com url", async () => {
  const { db, env } = mk();
  assert.equal((await getMe(env)).status, 401);
  addUser(db, "A");
  const r = await getMe(env, await cookie("A"));
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.user.userId, "A");
  assert.deepEqual(j.invitePrompt, { show: true, url: INVITE });
});

test("/api/me: sem URL ou URL inválida => show=false, url=null", async () => {
  for (const bad of [undefined, "", "http://evil.com", "javascript:alert(1)", "https://discord.gg.evil.com/abc", "https://discord.gg/a", "https://discord.gg/abc/def", "https://evil.com/discord.gg/abc"]) {
    const { db, env } = mk({ DISCORD_INVITE_URL: bad });
    addUser(db, "A");
    const j = await (await getMe(env, await cookie("A"))).json();
    assert.deepEqual(j.invitePrompt, { show: false, url: null }, String(bad));
  }
  const { db, env } = mk({ DISCORD_INVITE_URL: "https://discord.com/invite/abc-123" });
  addUser(db, "A");
  assert.equal((await (await getMe(env, await cookie("A"))).json()).invitePrompt.url, "https://discord.com/invite/abc-123");
});

test("/api/me: coluna ausente (0004 não aplicada) não derruba", async () => {
  const { db, env } = mk({}, 3);
  addUser(db, "A");
  const r = await getMe(env, await cookie("A"));
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).invitePrompt, { show: false, url: INVITE });
});

test("POST accepted/dismissed: 204, idempotente, show=false depois, url permanece", async () => {
  for (const action of ["accepted", "dismissed"]) {
    const { db, env } = mk();
    addUser(db, "A");
    const c = await cookie("A");
    const r = await postPrompt(env, c, { action });
    assert.equal(r.status, 204);
    assert.equal(await r.text(), "");
    const first = db.prepare("SELECT invite_prompt_seen_at AS s FROM discord_users WHERE user_id='A'").get().s;
    assert.ok(first);
    assert.equal((await postPrompt(env, c, { action })).status, 204);
    assert.equal(db.prepare("SELECT invite_prompt_seen_at AS s FROM discord_users WHERE user_id='A'").get().s, first);
    assert.deepEqual((await (await getMe(env, c)).json()).invitePrompt, { show: false, url: INVITE });
  }
});

test("POST: usuário A não afeta B", async () => {
  const { db, env } = mk();
  addUser(db, "A"); addUser(db, "B");
  assert.equal((await postPrompt(env, await cookie("A"), { action: "accepted" })).status, 204);
  assert.equal((await (await getMe(env, await cookie("B"))).json()).invitePrompt.show, true);
  assert.equal(db.prepare("SELECT invite_prompt_seen_at AS s FROM discord_users WHERE user_id='B'").get().s, null);
});

test("POST: erros 400/401/403/405/415", async () => {
  const { db, env } = mk();
  addUser(db, "A");
  const c = await cookie("A");
  let r = await postPrompt(env, c, { action: "x" });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).ok, false);
  assert.equal((await postPrompt(env, c, {})).status, 400);
  assert.equal((await postPrompt(env, c, "{nope")).status, 400);
  assert.equal((await postPrompt(env, undefined, { action: "accepted" })).status, 401);
  assert.equal((await postPrompt(env, c, { action: "accepted" }, { origin: "https://evil.com" })).status, 403);
  r = await postPrompt(env, c, undefined, { method: "GET" });
  assert.equal(r.status, 405);
  assert.equal(r.headers.get("Allow"), "POST");
  assert.equal((await postPrompt(env, c, "action=accepted", { ct: "text/plain" })).status, 415);
  assert.equal(db.prepare("SELECT invite_prompt_seen_at AS s FROM discord_users WHERE user_id='A'").get().s, null);
});

test("callback: upsert não preenche nem zera invite_prompt_seen_at", () => {
  const src = readFileSync(new URL("../functions/api/auth/discord/callback.js", import.meta.url), "utf8");
  assert.ok(!src.includes("invite_prompt_seen_at"));
  const { db } = mk();
  const upsert = "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP";
  db.prepare(upsert).run("N", "n", null);
  assert.equal(db.prepare("SELECT invite_prompt_seen_at AS s FROM discord_users WHERE user_id='N'").get().s, null);
  db.prepare("UPDATE discord_users SET invite_prompt_seen_at='2026-01-01' WHERE user_id='N'").run();
  db.prepare(upsert).run("N", "n2", "av");
  assert.equal(db.prepare("SELECT invite_prompt_seen_at AS s FROM discord_users WHERE user_id='N'").get().s, "2026-01-01");
});
