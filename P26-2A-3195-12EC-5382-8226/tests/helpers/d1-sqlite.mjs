/**
 * Adaptador mínimo que imita a API do Cloudflare D1 (prepare/bind/first/all/run/batch)
 * usando o SQLite embutido do Node (node:sqlite). Serve só para os testes de integração:
 * o SQL executado é exatamente o mesmo das Functions e da migration.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function loadSqlite() {
  try {
    const mod = await import("node:sqlite");
    return mod.DatabaseSync;
  } catch {
    return null; // Node sem node:sqlite (versões antigas): os testes de integração são pulados
  }
}

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params) {
    return new Statement(this.db, this.sql, params);
  }
  _stmt() {
    return this.db.prepare(this.sql);
  }
  async first(column) {
    const row = this._stmt().get(...this.params);
    if (row === undefined) return null;
    const plain = { ...row };
    return column ? plain[column] : plain;
  }
  async all() {
    return { success: true, results: this._stmt().all(...this.params).map((r) => ({ ...r })), meta: {} };
  }
  async run() {
    const info = this._stmt().run(...this.params);
    return { success: true, meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
  }
}

export function createD1(DatabaseSync) {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of fs.readdirSync(path.join(root, "migrations")).sort()) {
    if (file.endsWith(".sql")) db.exec(fs.readFileSync(path.join(root, "migrations", file), "utf8"));
  }
  return {
    raw: db,
    prepare: (sql) => new Statement(db, sql),
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
  };
}
