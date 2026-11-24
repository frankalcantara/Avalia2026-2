CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  total_chapters INTEGER NOT NULL,
  total_pages INTEGER NOT NULL,
  is_current INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS enrollments (
  user_id TEXT NOT NULL,
  book_id INTEGER NOT NULL,
  current_chapter INTEGER DEFAULT 0,
  current_page INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, book_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (book_id) REFERENCES books(id)
);
CREATE TABLE IF NOT EXISTS forum_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar TEXT,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (book_id) REFERENCES books(id)
);
INSERT INTO books (title, author, total_chapters, total_pages, is_current)
VALUES ('Duna', 'Frank Herbert', 30, 688, 1);