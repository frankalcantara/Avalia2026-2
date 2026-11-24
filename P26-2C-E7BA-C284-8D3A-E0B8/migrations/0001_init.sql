-- Esquema Inicial Cloudflare D1 para P26-2C-E7BA-C284-8D3A-E0B8 (Projeto #45)
CREATE TABLE IF NOT EXISTS discord_users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  chave_projeto TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_records_user ON project_records(user_id);

-- Livros

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL UNIQUE,
  total_chapters INTEGER NOT NULL CHECK(total_chapters > 0),
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- Inscrições

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  user_id TEXT NOT NULL,

  book_id INTEGER NOT NULL,

  subscribed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, book_id)
);

-- Progresso de leitura

CREATE TABLE IF NOT EXISTS reading_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  user_id TEXT NOT NULL,

  book_id INTEGER NOT NULL,

  current_chapter INTEGER NOT NULL DEFAULT 1 CHECK(current_chapter > 0),

  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, book_id)
);

-- Fórum por capítulo

CREATE TABLE IF NOT EXISTS forum_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  user_id TEXT NOT NULL,

  username TEXT NOT NULL,

  book_id INTEGER NOT NULL,

  chapter INTEGER NOT NULL CHECK(chapter > 0),

  content TEXT NOT NULL,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices

CREATE INDEX IF NOT EXISTS idx_progress_user
ON reading_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_progress_book
ON reading_progress(book_id);

CREATE INDEX IF NOT EXISTS idx_posts_chapter
ON forum_posts(book_id, chapter);
