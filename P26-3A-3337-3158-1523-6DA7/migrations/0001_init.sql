-- Esquema Inicial Cloudflare D1 para P26-3A-3337-3158-1523-6DA7 (Projeto #20)
-- Gerenciador de Horas Complementares

CREATE TABLE IF NOT EXISTS discord_users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ensino','pesquisa','extensao')),
  title TEXT NOT NULL,
  hours REAL NOT NULL CHECK (hours > 0),
  certificate_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES discord_users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_cat ON activities(user_id, category);
