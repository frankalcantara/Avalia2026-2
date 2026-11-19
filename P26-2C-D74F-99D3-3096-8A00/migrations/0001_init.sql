-- Esquema Inicial Cloudflare D1 para P26-2C-D74F-99D3-3096-8A00 (Projeto #34)
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
