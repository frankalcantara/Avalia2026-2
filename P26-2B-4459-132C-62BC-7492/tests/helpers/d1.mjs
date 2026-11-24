// Simulação mínima da API do Cloudflare D1 sobre node:sqlite — usada apenas nos testes locais.
import { DatabaseSync } from 'node:sqlite';

export function createD1() {
  const sqlite = new DatabaseSync(':memory:'); // chaves estrangeiras ligadas por padrão
  const isSelect = (sql) => /^\s*SELECT/i.test(sql);

  const statement = (sql, params = []) => ({
    sql,
    bind: (...p) => statement(sql, p),
    first: async (col) => {
      const row = sqlite.prepare(sql).get(...params);
      if (row === undefined) return null;
      return col ? row[col] : { ...row };
    },
    all: async () => ({ results: sqlite.prepare(sql).all(...params).map((r) => ({ ...r })), success: true, meta: {} }),
    run: async () => {
      const r = sqlite.prepare(sql).run(...params);
      return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
  });

  return {
    prepare: (sql) => statement(sql),
    // D1 executa o lote em uma transação: tudo ou nada.
    batch: async (statements) => {
      sqlite.exec('BEGIN');
      try {
        const out = [];
        for (const s of statements) out.push(isSelect(s.sql) ? await s.all() : await s.run());
        sqlite.exec('COMMIT');
        return out;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
    exec: async (sql) => sqlite.exec(sql),
    _sqlite: sqlite,
  };
}
