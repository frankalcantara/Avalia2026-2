CREATE TABLE IF NOT EXISTS discord_users (
  user_id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL,
  avatar TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS daily_words (
  date TEXT PRIMARY KEY NOT NULL,
  answer TEXT NOT NULL CHECK (length(answer) = 5)
);

CREATE TABLE IF NOT EXISTS attempts (
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  date TEXT NOT NULL REFERENCES daily_words(date),
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 6),
  guess TEXT NOT NULL CHECK (length(guess) = 5),
  marks TEXT NOT NULL,
  is_win INTEGER NOT NULL CHECK (is_win IN (0, 1)),
  PRIMARY KEY (user_id, date, position),
  UNIQUE (user_id, date, guess)
);
