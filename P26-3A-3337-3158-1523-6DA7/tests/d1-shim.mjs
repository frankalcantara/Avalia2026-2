/**
 * Simulador minimo do Cloudflare D1 sobre node:sqlite (SQLite real, zero dependencias).
 * Suporta prepare().bind().run()/first()/all() e batch(), como usado pelas Functions.
 */
import { DatabaseSync } from "node:sqlite";

export function createD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");

  function prepare(sql) {
    let params = [];
    const stmt = {
      bind(...p) {
        params = p;
        return stmt;
      },
      async run() {
        const r = db.prepare(sql).run(...params);
        return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
      },
      async first() {
        return db.prepare(sql).get(...params) ?? null;
      },
      async all() {
        return { success: true, results: db.prepare(sql).all(...params), meta: {} };
      },
    };
    return stmt;
  }

  return {
    prepare,
    async batch(statements) {
      const out = [];
      for (const s of statements) out.push(await s.run());
      return out;
    },
    _raw: db,
  };
}
