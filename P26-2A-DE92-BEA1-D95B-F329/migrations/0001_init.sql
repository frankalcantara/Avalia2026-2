-- Projeto #39: Construtor de Portfólio e Currículo Acadêmico
-- Chave: P26-2A-DE92-BEA1-D95B-F329
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS discord_users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS curricula (
  user_id TEXT PRIMARY KEY REFERENCES discord_users(user_id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK(length(full_name) BETWEEN 2 AND 120),
  headline TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'modern' CHECK(theme IN ('modern', 'classic', 'minimal')),
  is_public INTEGER NOT NULL DEFAULT 0 CHECK(is_public IN (0, 1)), updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_curricula_public ON curricula(is_public);
CREATE TABLE IF NOT EXISTS curriculum_education (
  user_id TEXT NOT NULL REFERENCES curricula(user_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  institution TEXT NOT NULL DEFAULT '', course TEXT NOT NULL DEFAULT '', start TEXT NOT NULL DEFAULT '',
  end TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, position)
);
CREATE TABLE IF NOT EXISTS curriculum_experience (
  user_id TEXT NOT NULL REFERENCES curricula(user_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  company TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '', start TEXT NOT NULL DEFAULT '',
  end TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, position)
);
CREATE TABLE IF NOT EXISTS curriculum_projects (
  user_id TEXT NOT NULL REFERENCES curricula(user_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
  repository TEXT NOT NULL DEFAULT '', technologies TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, position)
);
CREATE TABLE IF NOT EXISTS curriculum_skills (
  user_id TEXT NOT NULL REFERENCES curricula(user_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '', level TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, position)
);
CREATE TABLE IF NOT EXISTS curriculum_links (
  user_id TEXT NOT NULL REFERENCES curricula(user_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, position)
);
