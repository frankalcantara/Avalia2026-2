CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS kudos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user_id TEXT NOT NULL REFERENCES users(id),
  to_user_id TEXT NOT NULL REFERENCES users(id),
  badge TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_kudos_to ON kudos(to_user_id);
CREATE INDEX IF NOT EXISTS idx_kudos_from ON kudos(from_user_id);
CREATE INDEX IF NOT EXISTS idx_kudos_created ON kudos(created_at);
