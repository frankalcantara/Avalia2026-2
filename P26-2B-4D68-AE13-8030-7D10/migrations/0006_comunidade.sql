-- Tags, histórico de revisões e denúncias de comentário.

CREATE TABLE IF NOT EXISTS article_tags (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (article_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag ON article_tags(tag);

CREATE TABLE IF NOT EXISTS article_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  room_id INTEGER,
  edited_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_article_revisions_article
  ON article_revisions(article_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS comment_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (comment_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_reports_comment ON comment_reports(comment_id);
