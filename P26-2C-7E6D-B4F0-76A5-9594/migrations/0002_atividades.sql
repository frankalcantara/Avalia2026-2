CREATE TABLE IF NOT EXISTS atividades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('ensino', 'pesquisa', 'extensao')),
  horas INTEGER NOT NULL CHECK (horas > 0),
  link_certificado TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES discord_users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_atividades_user_cat ON atividades(user_id, categoria);