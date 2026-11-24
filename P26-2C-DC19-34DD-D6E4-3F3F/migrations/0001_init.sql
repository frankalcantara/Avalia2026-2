-- Esquema relacional do Cloudflare D1 (SQLite)
-- Chave de auditoria: P26-2C-DC19-34DD-D6E4-3F3F

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,                 -- user_id do Discord (snowflake)
  username    TEXT NOT NULL,
  avatar_url  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,                 -- SHA-256 (hex) do token do cookie
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,                    -- ISO 8601 UTC
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS topics (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id           TEXT NOT NULL REFERENCES users(id),
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  accepted_answer_id  INTEGER REFERENCES answers(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_topics_status_created ON topics(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topics_author ON topics(author_id);

CREATE TABLE IF NOT EXISTS answers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id    INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_answers_topic ON answers(topic_id, created_at);
