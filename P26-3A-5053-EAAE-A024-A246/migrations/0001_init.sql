CREATE TABLE IF NOT EXISTS discord_users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  global_name TEXT,
  avatar TEXT
);

CREATE TABLE IF NOT EXISTS livros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dono_id TEXT NOT NULL REFERENCES discord_users(user_id),
  titulo TEXT NOT NULL,
  autor TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('Técnico', 'Literário')),
  modalidade TEXT NOT NULL CHECK (modalidade IN ('Emprestar', 'Trocar', 'Ambos')),
  status TEXT NOT NULL DEFAULT 'Disponível'
    CHECK (status IN ('Disponível', 'Reservado', 'Emprestado'))
);

CREATE INDEX IF NOT EXISTS idx_livros_dono_id
  ON livros(dono_id);

CREATE TABLE IF NOT EXISTS emprestimos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  livro_id INTEGER NOT NULL REFERENCES livros(id),
  solicitante_id TEXT NOT NULL REFERENCES discord_users(user_id),
  status TEXT NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente', 'Aprovado', 'Recusado', 'Devolvido', 'Cancelado')),
  mensagem TEXT,
  data_prevista_devolucao TEXT,
  decidido_em TEXT,
  devolvido_em TEXT
);

CREATE INDEX IF NOT EXISTS idx_emprestimos_solicitante_id
  ON emprestimos(solicitante_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_emprestimo_ativo
  ON emprestimos(livro_id)
  WHERE status IN ('Pendente', 'Aprovado');
