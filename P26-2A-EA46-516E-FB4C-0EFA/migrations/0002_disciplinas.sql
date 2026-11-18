CREATE TABLE IF NOT EXISTS disciplinas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  media_aprovacao REAL NOT NULL DEFAULT 7,
  media_exame REAL NOT NULL DEFAULT 4,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_disciplinas_user ON disciplinas(user_id);

CREATE TABLE IF NOT EXISTS avaliacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  disciplina_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  peso REAL NOT NULL,
  nota REAL
);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_disc ON avaliacoes(disciplina_id);