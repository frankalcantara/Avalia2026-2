-- Tabela do diário: cada entrada pertence a um usuário do Discord
CREATE TABLE IF NOT EXISTS entradas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  texto TEXT NOT NULL,
  impedimento TEXT NOT NULL DEFAULT 'nenhum'
    CHECK (impedimento IN ('nenhum', 'baixo', 'medio', 'critico')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Toda consulta filtra por dono e ordena por data
CREATE INDEX IF NOT EXISTS idx_entradas_user_data ON entradas(user_id, created_at);