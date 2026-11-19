// Run with: node --no-warnings tests/api.smoke.mjs
// Exercises every API handler against an in-memory SQLite (node:sqlite) wrapped like D1:
// auth, isolation between users, validation limits, search, tag filters and cleanup.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import crypto from "node:crypto";
import * as notes from "../functions/api/notes/index.js";
import * as note from "../functions/api/notes/[id].js";
import * as tags from "../functions/api/tags.js";
import * as me from "../functions/api/me.js";
import * as logout from "../functions/api/auth/logout.js";
import { sha256Hex } from "../functions/_lib/auth.js";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(fs.readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8"));
sqlite.exec(fs.readFileSync(new URL("../migrations/0002_notas_tags.sql", import.meta.url), "utf8"));

function stmt(sql, params = []) {
  return {
    bind: (...p) => stmt(sql, p),
    run: async () => { const r = sqlite.prepare(sql).run(...params); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
    first: async () => sqlite.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
    _run: () => { const r = sqlite.prepare(sql).run(...params); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
  };
}
const DB = { prepare: (sql) => stmt(sql), batch: async (list) => list.map((s) => s._run()) };
const env = { DB };

async function login(userId, name) {
  sqlite.prepare("INSERT OR REPLACE INTO discord_users (user_id, username, avatar) VALUES (?,?,?)").run(userId, name, "https://x/a.png");
  const token = crypto.randomBytes(32).toString("hex");
  sqlite.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)").run(await sha256Hex(token), userId, Math.floor(Date.now() / 1000) + 3600);
  return `session=${token}`;
}
const req = (url, { method = "GET", cookie, body } = {}) =>
  new Request("https://t.test" + url, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
const call = async (fn, request, params = {}) => { const r = await fn({ request, env, params }); return { status: r.status, body: await r.json().catch(() => null), res: r }; };

let fails = 0;
const check = (name, cond, extra = "") => { console.log((cond ? "PASS " : "FAIL ") + name + (cond ? "" : " " + JSON.stringify(extra))); if (!cond) fails++; };

const A = await login("111", "Ana");
const B = await login("222", "Beto");

check("401 without cookie (list)", (await call(notes.onRequestGet, req("/api/notes"))).status === 401);
check("401 with forged cookie", (await call(notes.onRequestGet, req("/api/notes", { cookie: "session=" + "a".repeat(64) }))).status === 401);
check("401 with old unsigned cookie format", (await call(notes.onRequestGet, req("/api/notes", { cookie: "discord_session=eyJ1c2VySWQiOiIxMTEifQ" }))).status === 401);

let r = await call(me.onRequestGet, req("/api/me", { cookie: A }));
check("me returns user", r.status === 200 && r.body.user.userId === "111" && r.body.user.username === "Ana", r.body);

r = await call(notes.onRequestPost, req("/api/notes", { method: "POST", cookie: A, body: { title: "Redes", content: "# camadas\nTCP e UDP", tags: ["Redes", "#prova", "redes"] } }));
check("create note 201", r.status === 201 && r.body.id > 0, r);
const id1 = r.body.id;
r = await call(notes.onRequestPost, req("/api/notes", { method: "POST", cookie: A, body: { title: "Cálculo", content: "limites 100% e _", tags: ["prova"] } }));
const id2 = r.body.id;

r = await call(notes.onRequestGet, req("/api/notes", { cookie: A }));
check("list returns 2 notes", r.body.length === 2, r.body);
check("tags deduped and normalized", JSON.stringify(r.body.find((n) => n.id === id1).tags) === JSON.stringify(["prova", "redes"]), r.body);

r = await call(notes.onRequestGet, req("/api/notes?tag=prova", { cookie: A }));
check("filter by tag prova -> 2", r.body.length === 2);
r = await call(notes.onRequestGet, req("/api/notes?tag=redes", { cookie: A }));
check("filter by tag redes -> 1 (full tag list kept)", r.body.length === 1 && r.body[0].tags.length === 2, r.body);
r = await call(notes.onRequestGet, req("/api/notes?q=UDP", { cookie: A }));
check("search in content", r.body.length === 1 && r.body[0].id === id1, r.body);
r = await call(notes.onRequestGet, req("/api/notes?q=100%25", { cookie: A }));
check("search escapes % wildcard", r.body.length === 1 && r.body[0].id === id2, r.body);
r = await call(notes.onRequestGet, req("/api/notes?q=%25", { cookie: A }));
check("lone % matches only literal % (1 note)", r.body.length === 1, r.body);
r = await call(notes.onRequestGet, req("/api/notes?q=rede", { cookie: A }));
check("search matches title/tag name", r.body.length === 1 && r.body[0].id === id1, r.body);
r = await call(notes.onRequestGet, req("/api/notes?q=redes&tag=prova", { cookie: A }));
check("search + tag combined", r.body.length === 1, r.body);

r = await call(tags.onRequestGet, req("/api/tags", { cookie: A }));
check("tags with counts", JSON.stringify(r.body) === JSON.stringify([{ name: "prova", total: 2 }, { name: "redes", total: 1 }]), r.body);

r = await call(note.onRequestGet, req("/api/notes/" + id1, { cookie: A }), { id: String(id1) });
check("get one note with content + tags", r.status === 200 && r.body.content.includes("TCP") && r.body.tags.length === 2, r.body);

// isolation between users
r = await call(note.onRequestGet, req("/api/notes/" + id1, { cookie: B }), { id: String(id1) });
check("other user GET -> 404", r.status === 404);
r = await call(note.onRequestPut, req("/api/notes/" + id1, { method: "PUT", cookie: B, body: { title: "hack", content: "x", tags: [] } }), { id: String(id1) });
check("other user PUT -> 404", r.status === 404);
r = await call(note.onRequestDelete, req("/api/notes/" + id1, { method: "DELETE", cookie: B }), { id: String(id1) });
check("other user DELETE -> 404", r.status === 404);
r = await call(notes.onRequestGet, req("/api/notes", { cookie: B }));
check("other user sees none", r.body.length === 0);
r = await call(note.onRequestGet, req("/api/notes/" + id1, { cookie: A }), { id: String(id1) });
check("note still intact after attacks", r.status === 200 && r.body.title === "Redes");

// validation
const bad = async (name, body) => { const x = await call(notes.onRequestPost, req("/api/notes", { method: "POST", cookie: A, body })); check("400 " + name, x.status === 400, x); };
await bad("empty title", { title: "  ", content: "x" });
await bad("long title", { title: "a".repeat(121), content: "" });
await bad("huge content", { title: "t", content: "a".repeat(50001) });
await bad("too many tags", { title: "t", content: "", tags: Array.from({ length: 11 }, (_, i) => "t" + i) });
await bad("invalid tag", { title: "t", content: "", tags: ["com espaco"] });
await bad("invalid tag chars", { title: "t", content: "", tags: ["<b>"] });
await bad("body is array", [1, 2]);
r = await call(note.onRequestGet, req("/api/notes/abc", { cookie: A }), { id: "abc" });
check("400 invalid id", r.status === 400);

// update + tag cleanup
r = await call(note.onRequestPut, req("/api/notes/" + id1, { method: "PUT", cookie: A, body: { title: "Redes 2", content: "novo", tags: ["prova"] } }), { id: String(id1) });
check("update ok", r.status === 200, r);
r = await call(tags.onRequestGet, req("/api/tags", { cookie: A }));
check("orphan tag 'redes' removed after update", JSON.stringify(r.body) === JSON.stringify([{ name: "prova", total: 2 }]), r.body);

// delete
r = await call(note.onRequestDelete, req("/api/notes/" + id2, { method: "DELETE", cookie: A }), { id: String(id2) });
check("delete ok", r.status === 200, r);
r = await call(note.onRequestGet, req("/api/notes/" + id2, { cookie: A }), { id: String(id2) });
check("deleted note -> 404", r.status === 404);
check("note_tags rows cleaned", sqlite.prepare("SELECT COUNT(*) c FROM note_tags WHERE note_id=?").get(id2).c === 0);

// logout
r = await call(logout.onRequestPost, req("/api/auth/logout", { method: "POST", cookie: A }));
check("logout ok + clears cookie", r.status === 200 && /Max-Age=0/.test(r.res.headers.get("Set-Cookie")), r.res.headers.get("Set-Cookie"));
r = await call(notes.onRequestGet, req("/api/notes", { cookie: A }));
check("session dead after logout", r.status === 401);

// expired session
const old = crypto.randomBytes(32).toString("hex");
sqlite.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)").run(await sha256Hex(old), "111", Math.floor(Date.now() / 1000) - 5);
r = await call(notes.onRequestGet, req("/api/notes", { cookie: "session=" + old }));
check("expired session -> 401", r.status === 401);

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
