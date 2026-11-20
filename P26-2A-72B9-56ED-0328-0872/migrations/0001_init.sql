CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS project_modules (
  name TEXT PRIMARY KEY CHECK (name IN ('Requisitos', 'Arquitetura', 'Codificação', 'Testes')),
  estimate_minutes INTEGER NOT NULL DEFAULT 0 CHECK (estimate_minutes >= 0),
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sort_order INTEGER NOT NULL UNIQUE
);
INSERT OR IGNORE INTO project_modules (name, estimate_minutes, sort_order) VALUES
  ('Requisitos', 480, 1), ('Arquitetura', 720, 2), ('Codificação', 2400, 3), ('Testes', 960, 4);
CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_name TEXT NOT NULL CHECK (length(project_name) BETWEEN 1 AND 100),
  module TEXT NOT NULL CHECK (module IN ('Requisitos', 'Arquitetura', 'Codificação', 'Testes')),
  description TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (ended_at IS NULL OR ended_at > started_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_one_active_timer_per_user ON time_entries(user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_started_at ON time_entries(started_at, module);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_started_at ON time_entries(user_id, started_at);
