CREATE TABLE IF NOT EXISTS sessoes (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  expira_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessoes_user_id
  ON sessoes(user_id);

CREATE TABLE IF NOT EXISTS cartoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  titulo TEXT NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 120),
  descricao TEXT NOT NULL DEFAULT '' CHECK (length(descricao) <= 1000),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  coluna TEXT NOT NULL DEFAULT 'a_fazer' CHECK (coluna IN ('a_fazer', 'em_execucao', 'concluido')),
  posicao REAL NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cartoes_user_coluna_posicao
  ON cartoes(user_id, coluna, posicao);
