CREATE TABLE IF NOT EXISTS discord_users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  course_code TEXT NOT NULL REFERENCES courses(code) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, course_code)
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL REFERENCES courses(code),
  author_id TEXT NOT NULL REFERENCES discord_users(user_id),
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_states (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_course
  ON subscriptions(user_id, course_code);
CREATE INDEX IF NOT EXISTS idx_posts_course_created
  ON posts(course_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author
  ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_post_states_user_pinned
  ON post_states(user_id, is_pinned, post_id);

INSERT OR IGNORE INTO courses (code, title) VALUES
  ('MAT101', 'Matemática'),
  ('FIS101', 'Física'),
  ('QUI101', 'Química'),
  ('POR101', 'Língua Portuguesa'),
  ('PROG101', 'Programação');
