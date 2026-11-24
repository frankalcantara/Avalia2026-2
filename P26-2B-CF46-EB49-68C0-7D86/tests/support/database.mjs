import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

export const migration = readFileSync(new URL("../../migrations/0002_bibliografia.sql", import.meta.url), "utf8");

export function bind(sqlite, { beforeRun } = {}) {
  return {
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    prepare(sql) {
      const operation = (values = []) => ({
        bind: (...args) => operation(args),
        first: async (column) => {
          const row = sqlite.prepare(sql).get(...values);
          return column === undefined ? row ?? null : row?.[column] ?? null;
        },
        all: async () => ({ success: true, results: sqlite.prepare(sql).all(...values) }),
        run: async () => {
          beforeRun?.(sql);
          return { success: true, meta: sqlite.prepare(sql).run(...values) };
        },
      });
      return operation();
    },
  };
}

export function seedSession(sqlite, id) {
  const token = randomBytes(32).toString("base64url");
  const expires = Math.floor(Date.now() / 1000) + 3600;
  sqlite.prepare("INSERT INTO users(id, discord_id, display_name, avatar_url) VALUES (?, ?, ?, ?)")
    .run(id, id + "-discord", id, "https://example.org/avatar.png");
  sqlite.prepare("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(createHash("sha256").update(token).digest("hex"), id, expires);
  return token;
}
