// Shim mínimo de D1 sobre node:sqlite (em memória), com o esquema real das migrations.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";

const SQL = readFileSync(new URL("../../migrations/0001_init.sql", import.meta.url), "utf8");

class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.db, this.sql, args); }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { const results = this.db.prepare(this.sql).all(...this.args); return { results, success: true, meta: {} }; }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  _runSync() { return this.db.prepare(this.sql).run(...this.args); }
}

export function criarDB() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SQL);
  return {
    raw: db,
    prepare: (sql) => new Stmt(db, sql),
    async batch(stmts) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) {
          const r = s._runSync();
          out.push({ success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } });
        }
        db.exec("COMMIT");
        return out;
      } catch (e) { db.exec("ROLLBACK"); throw e; }
    },
  };
}

export function criarEnv(extra = {}) {
  return { DB: criarDB(), DISCORD_CLIENT_ID: "cid", DISCORD_CLIENT_SECRET: "sec", ...extra };
}

export const BASE = "https://duvidas.test";

export function addUsuario(env, id, username = "user" + id) {
  env.DB.raw.prepare("INSERT INTO users (id, username, avatar_url) VALUES (?, ?, ?)").run(id, username, "https://x/a.png");
}

// Cria sessão direta no banco e devolve o cookie.
export function addSessao(env, userId, { expiraEm = Date.now() + 3600_000 } = {}) {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  env.DB.raw.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(hash, userId, new Date(expiraEm).toISOString());
  return { token, hash, cookie: `sid=${token}` };
}

export function req(caminho, { method = "GET", cookie, body, headers = {}, origin = BASE, ct = "application/json", raw } = {}) {
  const h = new Headers(headers);
  if (cookie) h.set("Cookie", cookie);
  if (method === "POST") {
    if (origin) h.set("Origin", origin);
    if (ct) h.set("Content-Type", ct);
  }
  const init = { method, headers: h };
  if (method === "POST") init.body = raw !== undefined ? raw : JSON.stringify(body ?? {});
  return new Request(BASE + caminho, init);
}

export function addTopico(env, autor, titulo = "Titulo valido", corpo = "Corpo valido do topico") {
  return Number(env.DB.raw.prepare("INSERT INTO topics (author_id, title, body) VALUES (?, ?, ?)").run(autor, titulo, corpo).lastInsertRowid);
}
export function addResposta(env, topico, autor, corpo = "Resposta valida") {
  return Number(env.DB.raw.prepare("INSERT INTO answers (topic_id, author_id, body) VALUES (?, ?, ?)").run(topico, autor, corpo).lastInsertRowid);
}
