import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

// Execute the application's real SQL against SQLite, with D1's statement API.
export function testDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrations = new URL("../migrations/", import.meta.url);
  for (const filename of readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(new URL(filename, migrations), "utf8"));
  }
  class Statement {
    constructor(sql, args = []) {
      this.sql = sql;
      this.args = args;
    }
    bind(...args) {
      return new Statement(this.sql, args);
    }
    async first(column) {
      const row = sqlite.prepare(this.sql).get(...this.args) || null;
      return column && row ? row[column] : row;
    }
    async all() {
      return {
        success: true,
        results: sqlite.prepare(this.sql).all(...this.args),
      };
    }
    async run() {
      const result = sqlite.prepare(this.sql).run(...this.args);
      return {
        success: true,
        meta: {
          changes: Number(result.changes),
          last_row_id: Number(result.lastInsertRowid),
        },
      };
    }
  }
  const DB = {
    prepare(sql) {
      return new Statement(sql);
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) {
          // D1 batch supports RETURNING and SELECT as well as write statements.
          const compiled = sqlite.prepare(statement.sql);
          const rows = compiled.columns().length
            ? compiled.all(...statement.args)
            : null;
          let result;
          if (rows) {
            result = {
              results: rows,
              success: true,
              meta: { changes: sqlite.prepare("SELECT changes() n").get().n },
            };
          } else {
            const write = compiled.run(...statement.args);
            result = {
              success: true,
              meta: {
                changes: Number(write.changes),
                last_row_id: Number(write.lastInsertRowid),
              },
            };
          }
          results.push(result);
        }
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { DB, sqlite };
}
