-- Projeto #10: Rastreador de Hábitos (Habit Tracker)
-- Chave: P26-2A-3195-12EC-5382-8226
-- Esquema relacional do Cloudflare D1 (SQLite)

-- Usuários importados do Discord via OAuth2 (user_id, nome de usuário e avatar)
CREATE TABLE IF NOT EXISTS users (
  user_id      TEXT PRIMARY KEY,                 -- snowflake do Discord
  username     TEXT NOT NULL,                    -- @username do Discord
  display_name TEXT,                             -- global_name (nome de exibição)
  avatar_hash  TEXT,                             -- hash do avatar (NULL = avatar padrão)
  avatar_url   TEXT NOT NULL,                    -- URL pronta do CDN do Discord
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessões do servidor: o cookie guarda um token aleatório; aqui fica apenas o SHA-256 dele
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,                   -- epoch em milissegundos
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Metas recorrentes (hábitos diários) de cada usuário
CREATE TABLE IF NOT EXISTS habits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  color      TEXT NOT NULL DEFAULT 'azul',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);
-- Nome único por usuário, sem diferenciar maiúsculas/minúsculas
CREATE UNIQUE INDEX IF NOT EXISTS uq_habits_user_name ON habits(user_id, name COLLATE NOCASE);

-- Registros de conclusão: (ID do hábito, data). Um registro por hábito por dia.
CREATE TABLE IF NOT EXISTS completions (
  habit_id   INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date       TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (habit_id, date)
);
CREATE INDEX IF NOT EXISTS idx_completions_date ON completions(date);
