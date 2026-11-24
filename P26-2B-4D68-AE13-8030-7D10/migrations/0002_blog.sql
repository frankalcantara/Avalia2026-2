CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  invite_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((visibility = 'private' AND invite_hash IS NOT NULL) OR visibility = 'public')
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_likes (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_room ON articles(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id, created_at, id);
