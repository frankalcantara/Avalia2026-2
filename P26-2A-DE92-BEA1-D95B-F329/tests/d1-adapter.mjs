import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/** D1-shaped adapter backed by real in-memory SQLite, not SQL string mocks. */
export class TestD1 {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    this.sqlite.exec('PRAGMA foreign_keys = ON');
    this.batches = [];
  }

  prepare(sql) {
    return new TestStatement(this, sql);
  }

  async batch(statements) {
    this.batches.push(statements.map(statement => ({ sql: statement.sql, bindCount: statement.values.length })));
    this.sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  async exec(sql) {
    this.sqlite.exec(sql);
    return { count: 1, duration: 0 };
  }

  close() { this.sqlite.close(); }
}

class TestStatement {
  constructor(db, sql, values = []) {
    this.db = db;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) { return new TestStatement(this.db, this.sql, values); }

  async first(column) {
    const row = this.db.sqlite.prepare(this.sql).get(...this.values);
    if (!row) return null;
    return column ? row[column] : { ...row };
  }

  async all() {
    const rows = this.db.sqlite.prepare(this.sql).all(...this.values);
    return { success: true, results: rows.map(row => ({ ...row })), meta: { duration: 0 } };
  }

  async run() {
    const prepared = this.db.sqlite.prepare(this.sql);
    if (prepared.columns().length) {
      return { success: true, results: prepared.all(...this.values).map(row => ({ ...row })), meta: { changes: 0, duration: 0 } };
    }
    const result = prepared.run(...this.values);
    return {
      success: true,
      results: [],
      meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid), duration: 0 },
    };
  }

  async raw() {
    const statement = this.db.sqlite.prepare(this.sql);
    statement.setReturnArrays(true);
    return statement.all(...this.values);
  }
}

export async function migratedDatabase() {
  const database = new TestD1();
  const directory = fileURLToPath(new URL('../migrations/', import.meta.url));
  for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    await database.exec(readFileSync(join(directory, name), 'utf8'));
  }
  return database;
}

export function curriculum(overrides = {}) {
  return {
    profile: {
      full_name: 'Pessoa de Teste', headline: 'Estudante de computação',
      email: 'pessoa@example.com', phone: '', location: 'Curitiba, PR',
      website: 'https://example.com', summary: 'Dados fictícios usados somente nos testes.',
    },
    education: [{ institution: 'Instituição Exemplo', course: 'Computação', start: '2024', end: '', description: '' }],
    experience: [{ company: 'Empresa Exemplo', role: 'Estágio', start: '2025', end: '', description: 'Atividades.' }],
    projects: [{ name: 'Projeto Exemplo', description: 'Demonstração', url: 'https://example.com/app', repository: 'https://github.com/example/project', technologies: 'HTML, CSS, JavaScript' }],
    skills: [{ name: 'JavaScript', level: 'Intermediário' }],
    links: [{ label: 'Repositórios', url: 'https://github.com/example' }],
    theme: 'modern', is_public: false,
    ...overrides,
  };
}
