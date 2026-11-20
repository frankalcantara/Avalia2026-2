-- 0002_mural_capsulas.sql
-- Esquema do Projeto #33: mural público e cápsulas do tempo.
-- Aplicar com: npx wrangler d1 migrations apply DB --remote

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,               -- user_id do Discord (snowflake)
  username    TEXT NOT NULL,
  avatar      TEXT,                           -- URL do avatar no CDN do Discord
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sessões: o navegador guarda só um token aleatório; aqui fica apenas o hash SHA-256.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL                   -- ISO 8601 UTC
);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Mural público (depoimentos imediatos).
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Cápsulas do tempo. unlock_date é ISO 8601 UTC (ex.: 2027-12-18T22:00:00.000Z),
-- formato que permite comparar datas como texto.
CREATE TABLE IF NOT EXISTS capsules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  content     TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  audience    TEXT NOT NULL CHECK (audience IN ('turma', 'self')),
  unlock_date TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_capsules_unlock ON capsules(unlock_date);
CREATE INDEX IF NOT EXISTS idx_capsules_user   ON capsules(user_id);
