-- Rastreador de Hábitos — esquema definitivo (Cloudflare D1 / SQLite)
-- Substitui as tabelas provisórias da 0001 (discord_users, habits com "title", habit_logs),
-- que não guardavam o que as regras de negócio exigem. Elas nunca foram usadas pelo app.

DROP TABLE IF EXISTS habit_logs;
DROP TABLE IF EXISTS habits;
DROP TABLE IF EXISTS discord_users;

CREATE TABLE users (
  id           TEXT PRIMARY KEY,                      -- user_id do Discord (snowflake)
  username     TEXT NOT NULL,
  display_name TEXT,
  avatar       TEXT,                                  -- hash do avatar no CDN do Discord
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE habits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  color      TEXT NOT NULL DEFAULT '#5eead4',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_habits_user ON habits(user_id);
CREATE UNIQUE INDEX idx_habits_user_name ON habits(user_id, name COLLATE NOCASE);

-- Um registro por (hábito, dia) concluído. A chave primária impede duplicatas.
CREATE TABLE completions (
  habit_id   INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date       TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (habit_id, date)
) WITHOUT ROWID;
