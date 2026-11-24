-- Acervo de Citações e Notas de Leitura (Projeto #41)
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  text TEXT NOT NULL,
  author TEXT NOT NULL,
  work TEXT,
  page INTEGER,
  reflection TEXT,
  is_public INTEGER NOT NULL DEFAULT 0 CHECK(is_public IN (0,1)),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_public_id ON quotes(is_public, id DESC);
