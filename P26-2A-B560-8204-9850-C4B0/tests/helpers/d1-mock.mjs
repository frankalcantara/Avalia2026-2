/**
 * Adapter D1-compatível sobre `node:sqlite` (zero dependências npm).
 *
 * Objetivo: rodar a suíte inteira 100% offline e determinística, exercitando as
 * mesmas consultas SQL, o mesmo `batch()` transacional e o mesmo contrato de
 * retorno (`{ results, success, meta }`) que o `D1Database` real.
 *
 * A migration oficial (`migrations/0001_init.sql`) é aplicada no setup, o que
 * também valida a sintaxe SQL e os `CHECK`/`FOREIGN KEY` do esquema.
 *
 * @module tests/helpers/d1-mock
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Raiz do projeto (PROJECT_DIR), calculada a partir deste arquivo. */
export const PROJECT_DIR = resolve(HERE, "..", "..");

/** Caminho absoluto da migration inicial. */
export const MIGRATION_PATH = resolve(PROJECT_DIR, "migrations", "0001_init.sql");

/** SQL que produz linhas (precisa de `.all()` em vez de `.run()`). */
const ROW_PRODUCING_SQL = /^\s*(select|with|pragma|explain|values)\b/i;

/**
 * Converte uma linha do `node:sqlite` (objeto com protótipo nulo) em objeto comum.
 *
 * @param {Record<string, unknown>} row Linha retornada pelo driver.
 * @returns {Record<string, unknown>} Objeto plano.
 */
function toPlainRow(row) {
  if (row === null || typeof row !== "object") return row;
  const plain = {};
  for (const [key, value] of Object.entries(row)) {
    plain[key] = typeof value === "bigint" ? Number(value) : value;
  }
  return plain;
}

/**
 * Normaliza um argumento de bind para os tipos aceitos pelo `node:sqlite`.
 *
 * O D1 também não aceita `undefined`/`boolean`: convertemos para `NULL`/`0|1`
 * para manter o teste focado no comportamento do handler, não no driver.
 *
 * @param {unknown} value Valor vindo de `.bind(...)`.
 * @returns {unknown} Valor seguro para o driver.
 */
function normalizeArg(value) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "bigint") return Number(value);
  return value;
}

/**
 * Statement D1-compatível e imutável (`bind` devolve uma cópia ligada).
 */
class MockD1Statement {
  /** @type {MockD1} */
  #db;

  /** @type {string} */
  #sql;

  /** @type {unknown[]} */
  #args;

  /**
   * @param {MockD1} db Banco dono.
   * @param {string} sql SQL preparado.
   * @param {unknown[]} [args] Argumentos já ligados.
   */
  constructor(db, sql, args = []) {
    this.#db = db;
    this.#sql = sql;
    this.#args = args;
  }

  /** SQL preparado (útil em diagnóstico de testes). */
  get sql() {
    return this.#sql;
  }

  /** Argumentos ligados. */
  get args() {
    return [...this.#args];
  }

  /**
   * Liga os placeholders posicionais (`?`) — o projeto usa apenas este formato.
   *
   * @param {...unknown} args Valores na ordem dos `?`.
   * @returns {MockD1Statement} Novo statement ligado (não muta o atual, como no D1).
   */
  bind(...args) {
    return new MockD1Statement(this.#db, this.#sql, args);
  }

  /**
   * Primeira linha do resultado.
   *
   * @param {string} [column] Nome da coluna a extrair (semântica do D1).
   * @returns {Promise<Record<string, unknown> | unknown | null>} Linha, valor da coluna ou `null`.
   */
  async first(column) {
    const row = this.#db.statement(this.#sql).get(...this.#args.map(normalizeArg));
    if (row === undefined || row === null) return null;
    const plain = toPlainRow(row);
    if (typeof column === "string") {
      return plain[column] ?? null;
    }
    return plain;
  }

  /**
   * Todas as linhas.
   *
   * @returns {Promise<{ results: Array<Record<string, unknown>>, success: true, meta: object }>}
   */
  async all() {
    return this.execute();
  }

  /**
   * Executa semântica de escrita.
   *
   * @returns {Promise<{ results: unknown[], success: true, meta: object }>} Resultado no formato D1.
   */
  async run() {
    return this.execute();
  }

  /**
   * Executa o statement uma única vez devolvendo o envelope `D1Result`.
   *
   * @returns {{ results: Array<Record<string, unknown>>, success: true, meta: object }} Resultado.
   */
  execute() {
    const statement = this.#db.statement(this.#sql);
    const args = this.#args.map(normalizeArg);

    if (ROW_PRODUCING_SQL.test(this.#sql)) {
      const rows = statement.all(...args).map(toPlainRow);
      return {
        results: rows,
        success: true,
        meta: { duration: 0, changes: 0, last_row_id: 0, rows_read: rows.length, rows_written: 0 },
      };
    }

    const outcome = statement.run(...args);
    const changes = Number(outcome.changes ?? 0);
    return {
      results: [],
      success: true,
      meta: {
        duration: 0,
        changes,
        last_row_id: Number(outcome.lastInsertRowid ?? 0),
        rows_read: 0,
        rows_written: changes,
      },
    };
  }

  /**
   * Linhas como arrays posicionais (equivalente ao `raw()` do D1).
   *
   * @returns {Promise<unknown[][]>} Matriz de valores.
   */
  async raw() {
    const statement = this.#db.statement(this.#sql);
    const columns = statement.columns().map((column) => column.name);
    return statement
      .all(...this.#args.map(normalizeArg))
      .map((row) => columns.map((name) => toPlainRow(row)[name]));
  }
}

/**
 * Banco D1 falso sobre uma base SQLite em memória, já migrada.
 */
export class MockD1 {
  /** @type {DatabaseSync} */
  #sqlite;

  /** @type {Map<string, import("node:sqlite").StatementSync>} */
  #cache = new Map();

  /**
   * @param {{ migrationSql?: string }} [options] Permite injetar outro SQL de esquema.
   */
  constructor(options = {}) {
    this.#sqlite = new DatabaseSync(":memory:");
    const sql = options.migrationSql ?? readFileSync(MIGRATION_PATH, "utf8");
    // Executa a migration real: valida sintaxe, CHECKs, FKs e índices.
    this.#sqlite.exec(sql);
  }

  /**
   * Devolve (com cache) o statement compilado do `node:sqlite`.
   *
   * @param {string} sql SQL.
   * @returns {import("node:sqlite").StatementSync} Statement compilado.
   */
  statement(sql) {
    let compiled = this.#cache.get(sql);
    if (!compiled) {
      compiled = this.#sqlite.prepare(sql);
      this.#cache.set(sql, compiled);
    }
    return compiled;
  }

  /**
   * `D1Database.prepare`.
   *
   * @param {string} sql SQL com placeholders `?`.
   * @returns {MockD1Statement} Statement não ligado.
   */
  prepare(sql) {
    if (typeof sql !== "string" || sql.length === 0) {
      throw new TypeError("prepare() exige uma string SQL não vazia");
    }
    return new MockD1Statement(this, sql, []);
  }

  /**
   * `D1Database.batch` — execução sequencial dentro de uma transação.
   *
   * @param {MockD1Statement[]} statements Statements a executar.
   * @returns {Promise<object[]>} Um `D1Result` por statement.
   */
  async batch(statements) {
    if (!Array.isArray(statements)) {
      throw new TypeError("batch() exige um array de statements");
    }
    if (statements.length === 0) return [];

    this.#sqlite.exec("BEGIN");
    try {
      const results = statements.map((statement) => {
        if (!(statement instanceof MockD1Statement)) {
          throw new TypeError("batch() aceita apenas statements criados por prepare()");
        }
        return statement.execute();
      });
      this.#sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.#sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  /**
   * `D1Database.exec` — aceita múltiplos statements separados por `;`.
   *
   * @param {string} sql SQL bruto.
   * @returns {Promise<{ count: number, duration: number }>} Resumo.
   */
  async exec(sql) {
    this.#sqlite.exec(sql);
    return { count: 0, duration: 0 };
  }

  /** Encerra a base (usado no teardown de testes que abrem bancos extras). */
  close() {
    this.#cache.clear();
    this.#sqlite.close();
  }

  /**
   * Escape hatch só para asserções de infraestrutura (contagens, pragmas).
   *
   * @returns {DatabaseSync} Driver cru.
   */
  get driver() {
    return this.#sqlite;
  }
}

/**
 * Cria um banco D1 falso já migrado.
 *
 * @returns {MockD1} Banco novo, isolado em memória.
 */
export function createD1() {
  return new MockD1();
}
