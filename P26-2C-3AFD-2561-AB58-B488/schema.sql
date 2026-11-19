CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,           -- user_id do Discord
  username    TEXT NOT NULL,
  avatar      TEXT,                       -- hash do avatar (pode ser nulo)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_login  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,              -- trecho exato da citação
  author      TEXT NOT NULL,              -- autor original
  work        TEXT NOT NULL,              -- obra de referência
  page        TEXT NOT NULL,              -- página (texto: aceita "xii", "23-25")
  theme       TEXT,                       -- tema (opcional, usado na busca)
  notes       TEXT,                       -- anotações de reflexão
  is_public   INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quotes_user   ON quotes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_public ON quotes(is_public, created_at DESC);
