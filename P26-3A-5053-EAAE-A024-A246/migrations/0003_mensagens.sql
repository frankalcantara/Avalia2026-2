
CREATE TABLE IF NOT EXISTS mensagens_emprestimos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  emprestimo_id INTEGER NOT NULL
    REFERENCES emprestimos(id),
  remetente_id TEXT NOT NULL
    REFERENCES discord_users(user_id),
  conteudo TEXT NOT NULL
    CHECK (length(trim(conteudo)) BETWEEN 1 AND 1000),
  criada_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mensagens_emprestimo
  ON mensagens_emprestimos(emprestimo_id, criada_em);
