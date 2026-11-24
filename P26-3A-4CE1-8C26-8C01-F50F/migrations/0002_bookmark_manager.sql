-- Etapa 1: sessões e esquema do Bookmark Manager. Aplicar após a 0001.
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK (length(token_hash) = 64),
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at);

CREATE TABLE collections (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, name),
  UNIQUE (id, user_id)
);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  collection_id TEXT NOT NULL,
  url TEXT NOT NULL CHECK (length(url) BETWEEN 1 AND 2048),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  summary TEXT NOT NULL DEFAULT '' CHECK (length(summary) <= 2000),
  status TEXT NOT NULL DEFAULT 'para_ler'
    CHECK (status IN ('para_ler', 'lendo', 'concluido')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (collection_id, user_id)
    REFERENCES collections(id, user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_collections_user_order
  ON collections(user_id, created_at DESC, id DESC);
CREATE INDEX idx_bookmarks_user_order
  ON bookmarks(user_id, created_at DESC, id DESC);
CREATE INDEX idx_bookmarks_user_collection_order
  ON bookmarks(user_id, collection_id, created_at DESC, id DESC);
CREATE INDEX idx_bookmarks_user_status_order
  ON bookmarks(user_id, status, created_at DESC, id DESC);
CREATE INDEX idx_bookmarks_user_collection_status_order
  ON bookmarks(user_id, collection_id, status, created_at DESC, id DESC);
