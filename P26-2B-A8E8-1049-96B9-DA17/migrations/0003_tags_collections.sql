-- Tags e coleções de citações (idempotente)
CREATE TABLE IF NOT EXISTS quote_tags (
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (quote_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_quote_tags_tag ON quote_tags(tag, quote_id);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS collection_quotes (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, quote_id)
);
CREATE INDEX IF NOT EXISTS idx_collection_quotes_quote ON collection_quotes(quote_id);
