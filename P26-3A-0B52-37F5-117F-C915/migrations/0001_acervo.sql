CREATE TABLE IF NOT EXISTS discord_users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  text TEXT NOT NULL CHECK (length(trim(text)) BETWEEN 1 AND 3000),
  author TEXT NOT NULL CHECK (length(trim(author)) BETWEEN 1 AND 160),
  source TEXT NOT NULL CHECK (length(trim(source)) BETWEEN 1 AND 240),
  kind TEXT NOT NULL CHECK (kind IN ('livro','artigo','palestra')),
  page TEXT NOT NULL CHECK (length(page) <= 40 AND (kind = 'palestra' OR length(trim(page)) > 0)),
  theme TEXT NOT NULL CHECK (length(trim(theme)) BETWEEN 1 AND 100),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  visibility TEXT NOT NULL CHECK (visibility IN ('public','private')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS quotes_owner ON quotes (user_id, id DESC);
CREATE INDEX IF NOT EXISTS quotes_visibility ON quotes (visibility, id DESC);
