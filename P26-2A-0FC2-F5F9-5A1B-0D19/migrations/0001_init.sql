-- Projeto #26: Sistema de Enquetes e Votação Verificada
-- Chave: P26-2A-0FC2-F5F9-5A1B-0D19
-- Esquema relacional para Cloudflare D1 (SQLite)

-- O D1 já aplica chaves estrangeiras por padrão.

-- Usuários importados do Discord OAuth2 (user_id = snowflake do Discord)
CREATE TABLE IF NOT EXISTS users (
  user_id     TEXT PRIMARY KEY,
  username    TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sessões: somente o hash SHA-256 do token é armazenado
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Enquetes (closes_at em epoch ms UTC)
CREATE TABLE IF NOT EXISTS polls (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id  TEXT NOT NULL REFERENCES users(user_id),
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  closes_at   INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_polls_closes ON polls(closes_at);

-- Opções de cada enquete
CREATE TABLE IF NOT EXISTS poll_options (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id   INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label     TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 100),
  position  INTEGER NOT NULL,
  UNIQUE (poll_id, position)
);
CREATE INDEX IF NOT EXISTS idx_options_poll ON poll_options(poll_id);

-- Votos: UNIQUE(poll_id, user_id) bloqueia voto duplicado no próprio banco
CREATE TABLE IF NOT EXISTS votes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id    INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id  INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (poll_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_option ON votes(option_id);
