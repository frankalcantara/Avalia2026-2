// Adaptador que imita o binding D1 do Cloudflare sobre o sql.js (SQLite em
// WebAssembly), para os testes executarem as Pages Functions de verdade.
//
// API coberta: DB.prepare(sql).bind(...args).first(col?) / .all() / .run() /
// .raw(), DB.batch([stmts]) em transação e DB.exec(sql).
// Placeholders aceitos: ?NNN (ex.: ?1, ?2) e ? anônimo.
// Erros de SQL (inclusive de constraint) viram Error com a mensagem do SQLite,
// no mesmo formato do D1: "D1_ERROR: <mensagem do SQLite>: SQLITE_CONSTRAINT".

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const MIGRATION = fileURLToPath(
  new URL("../../migrations/0001_init.sql", import.meta.url),
);

let sqlPromise;
function loadSql() {
  sqlPromise ??= initSqlJs();
  return sqlPromise;
}

// Cede a vez ao loop de eventos antes de cada ida ao banco, como uma chamada
// de rede ao D1 faria. Assim, requisições disparadas com Promise.all se
// intercalam de verdade e uma lógica "lê a contagem e depois insere" falha.
const tick = () => new Promise((resolve) => setImmediate(resolve));

function d1Error(err) {
  const msg = String(err?.message ?? err);
  const code = /constraint/i.test(msg) ? "SQLITE_CONSTRAINT" : "SQLITE_ERROR";
  const e = new Error(`D1_ERROR: ${msg}: ${code}`, { cause: err });
  e.sqliteMessage = msg;
  return e;
}

function normalizeValue(v, index) {
  if (v === undefined) {
    throw new Error(
      `D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined' (parametro ${index + 1})`,
    );
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (v !== null && typeof v === "object" && !(v instanceof Uint8Array)) {
    throw new Error(`D1_TYPE_ERROR: Type '${typeof v}' not supported`);
  }
  return v;
}

class PreparedStatement {
  constructor(db, sql, params = []) {
    this._db = db;
    this._sql = sql;
    this._params = params;
  }

  bind(...args) {
    return new PreparedStatement(this._db, this._sql, args.map(normalizeValue));
  }

  // Executa de forma síncrona (usado também dentro do batch).
  _execSync() {
    const raw = this._db._raw;
    const before = this._db._scalar("SELECT total_changes()");
    let stmt;
    const rows = [];
    let columns = [];
    try {
      stmt = raw.prepare(this._sql);
      // sql.js liga array por índice: params[i] -> parâmetro i+1, que é
      // exatamente o ?NNN do SQLite; '?' anônimo também recebe índices 1..n.
      if (this._params.length) stmt.bind(this._params);
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
        if (!columns.length) columns = stmt.getColumnNames();
      }
      if (!columns.length) columns = stmt.getColumnNames();
    } catch (err) {
      throw d1Error(err);
    } finally {
      stmt?.free();
    }
    const after = this._db._scalar("SELECT total_changes()");
    const changes = after - before;
    const lastRowId = this._db._scalar("SELECT last_insert_rowid()");
    return {
      results: rows,
      columns,
      success: true,
      meta: {
        changes,
        last_row_id: lastRowId,
        changed_db: changes > 0,
        duration: 0,
        rows_read: rows.length,
        rows_written: changes,
      },
    };
  }

  async first(column) {
    await tick();
    const { results } = this._execSync();
    const row = results[0];
    if (row === undefined) return null;
    if (column === undefined) return row;
    if (!(column in row)) {
      throw new Error(`D1_COLUMN_NOTFOUND: Column not found (${column})`);
    }
    return row[column];
  }

  async all() {
    await tick();
    const { results, success, meta } = this._execSync();
    return { results, success, meta };
  }

  async run() {
    await tick();
    const { results, success, meta } = this._execSync();
    return { results, success, meta };
  }

  async raw(options = {}) {
    await tick();
    const { results, columns } = this._execSync();
    const arrays = results.map((r) => columns.map((c) => r[c]));
    return options.columnNames ? [columns, ...arrays] : arrays;
  }
}

export class FakeD1 {
  constructor(raw) {
    this._raw = raw;
    this.statements = []; // SQL de cada prepare, para auditoria nos testes
  }

  _scalar(sql) {
    const r = this._raw.exec(sql);
    return r[0]?.values[0]?.[0] ?? null;
  }

  prepare(sql) {
    if (typeof sql !== "string") throw new TypeError("prepare espera string");
    this.statements.push(sql);
    return new PreparedStatement(this, sql);
  }

  async batch(statements) {
    if (!Array.isArray(statements)) throw new TypeError("batch espera array");
    await tick();
    // Tudo síncrono entre BEGIN e COMMIT: nenhuma outra requisição intercala.
    this._raw.exec("BEGIN");
    try {
      const out = statements.map((s) => {
        if (!(s instanceof PreparedStatement)) {
          throw new TypeError("batch aceita apenas statements do prepare()");
        }
        const { results, success, meta } = s._execSync();
        return { results, success, meta };
      });
      this._raw.exec("COMMIT");
      return out;
    } catch (err) {
      try {
        this._raw.exec("ROLLBACK");
      } catch {
        /* transação já encerrada */
      }
      throw err;
    }
  }

  async exec(sql) {
    await tick();
    try {
      const r = this._raw.exec(sql);
      return { count: r.length, duration: 0 };
    } catch (err) {
      throw d1Error(err);
    }
  }

  async dump() {
    return this._raw.export().buffer;
  }

  // ---- utilidades só para os testes (não existem no D1 real) ----
  query(sql, params = []) {
    const stmt = this._raw.prepare(sql);
    try {
      if (params.length) stmt.bind(params.map(normalizeValue));
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  close() {
    this._raw.close();
  }
}

export async function createD1({ migrate = true } = {}) {
  const SQL = await loadSql();
  const raw = new SQL.Database();
  // O D1 aplica chaves estrangeiras por padrão.
  raw.exec("PRAGMA foreign_keys = ON;");
  if (migrate) raw.exec(readFileSync(MIGRATION, "utf8"));
  return new FakeD1(raw);
}
