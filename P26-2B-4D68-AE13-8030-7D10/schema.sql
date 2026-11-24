-- Esquema completo do D1 do Entrelinhas (P26-2B-4D68-AE13-8030-7D10).
-- Equivale ao estado final das migrações 0001 a 0006 (migrations/), com as colunas
-- articles.slug e rooms.join_policy já na criação das tabelas.
--
-- Uso: painel Cloudflare -> D1 -> seu banco -> Console -> cole este arquivo -> Execute.
-- O projeto não usa Wrangler; não há comando de terminal para aplicar o schema.
-- Referência completa: docs/schema-d1-e-orientacoes.md

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

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  invite_hash TEXT,
  join_policy TEXT NOT NULL DEFAULT 'open_link'
    CHECK (join_policy IN ('open_link', 'approval')),
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
  slug TEXT,
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

CREATE TABLE IF NOT EXISTS room_join_requests (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS room_blocks (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS article_tags (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (article_id, tag)
);

CREATE TABLE IF NOT EXISTS article_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  room_id INTEGER,
  edited_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comment_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (comment_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_room ON articles(room_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag ON article_tags(tag);
CREATE INDEX IF NOT EXISTS idx_article_revisions_article
  ON article_revisions(article_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_comment_reports_comment ON comment_reports(comment_id);
