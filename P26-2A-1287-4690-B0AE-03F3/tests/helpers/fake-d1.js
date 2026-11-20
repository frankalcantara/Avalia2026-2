// D1 simulado sobre node:sqlite (Node 22+). Aplica migrations/0001_init.sql.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(here, '..', '..', 'migrations', '0001_init.sql');

const plain = (row) => (row == null ? null : { ...row });

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params) {
    return new Statement(this.db, this.sql, params);
  }
  async first(col) {
    const row = plain(this.db.prepare(this.sql).get(...this.params));
    if (row == null) return null;
    return col ? row[col] : row;
  }
  async all() {
    const results = this.db.prepare(this.sql).all(...this.params).map(plain);
    return { results, success: true, meta: { changes: 0, last_row_id: 0 } };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.params);
    return {
      results: [],
      success: true,
      meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) },
    };
  }
}

export function createFakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(MIGRATION, 'utf8'));
  return {
    raw: db,
    prepare: (sql) => new Statement(db, sql),
    exec: async (sql) => { db.exec(sql); },
  };
}
