// D1 simulado sobre node:sqlite — expõe a mesma API usada pelas Functions:
// prepare(sql).bind(...).first()/all()/run() e batch([...]).
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS_DIR = new URL('../../migrations/', import.meta.url);

export function createFakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  // aplica todas as migrations em ordem, como o `wrangler d1 migrations apply`
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8'));
  }

  class Statement {
    constructor(sql) {
      this.sql = sql;
      this.params = [];
    }
    bind(...params) {
      this.params = params;
      return this;
    }
    async first(column) {
      const row = db.prepare(this.sql).get(...this.params);
      if (row === undefined) return null;
      const plain = { ...row };
      return column ? plain[column] : plain;
    }
    async all() {
      const results = db.prepare(this.sql).all(...this.params).map((r) => ({ ...r }));
      return { results, success: true };
    }
    async run() {
      const r = db.prepare(this.sql).run(...this.params);
      return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    }
  }

  return {
    prepare: (sql) => new Statement(sql),
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    raw: db,
  };
}
