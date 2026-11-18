// Gerado a partir de migrations/0001_acervo.sql por scripts/gerar-schema.mjs.
export const schemaStatements = [
  "CREATE TABLE IF NOT EXISTS discord_users (\n  user_id TEXT PRIMARY KEY,\n  username TEXT NOT NULL,\n  avatar TEXT,\n  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\n)",
  "CREATE TABLE IF NOT EXISTS quotes (\n  id INTEGER PRIMARY KEY,\n  user_id TEXT NOT NULL REFERENCES discord_users(user_id),\n  text TEXT NOT NULL CHECK (length(trim(text)) BETWEEN 1 AND 3000),\n  author TEXT NOT NULL CHECK (length(trim(author)) BETWEEN 1 AND 160),\n  source TEXT NOT NULL CHECK (length(trim(source)) BETWEEN 1 AND 240),\n  kind TEXT NOT NULL CHECK (kind IN ('livro','artigo','palestra')),\n  page TEXT NOT NULL CHECK (length(page) <= 40 AND (kind = 'palestra' OR length(trim(page)) > 0)),\n  theme TEXT NOT NULL CHECK (length(trim(theme)) BETWEEN 1 AND 100),\n  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 2000),\n  visibility TEXT NOT NULL CHECK (visibility IN ('public','private')),\n  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\n)",
  "CREATE INDEX IF NOT EXISTS quotes_owner ON quotes (user_id, id DESC)",
  "CREATE INDEX IF NOT EXISTS quotes_visibility ON quotes (visibility, id DESC)"
];
