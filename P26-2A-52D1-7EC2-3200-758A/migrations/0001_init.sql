-- Catálogo de Filmes e Séries com Avaliações da Turma
-- Chave: P26-2A-52D1-7EC2-3200-758A (Projeto #25)

-- Usuários vindos do login Discord (user_id, nome e avatar)
CREATE TABLE IF NOT EXISTS discord_users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sessões de login guardadas no servidor (o cookie guarda só um token aleatório)
CREATE TABLE IF NOT EXISTS sessoes (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  expira_em TEXT NOT NULL
);

-- Filmes e séries do catálogo
CREATE TABLE IF NOT EXISTS titulos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 120),
  tipo TEXT NOT NULL CHECK (tipo IN ('filme', 'serie')),
  ano_lancamento INTEGER NOT NULL CHECK (ano_lancamento BETWEEN 1888 AND 2100),
  genero TEXT,
  criado_por TEXT REFERENCES discord_users(user_id),
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (nome, ano_lancamento, tipo)
);

-- Avaliações: chave composta (user_id + filme_id) = só UMA nota por pessoa em cada obra
CREATE TABLE IF NOT EXISTS avaliacoes (
  user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  filme_id INTEGER NOT NULL REFERENCES titulos(id) ON DELETE CASCADE,
  nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  resenha TEXT NOT NULL DEFAULT '' CHECK (length(resenha) <= 500),
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, filme_id)
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_filme ON avaliacoes(filme_id);

-- Lista base de títulos (o usuário pode escolher daqui ou cadastrar novos)
INSERT OR IGNORE INTO titulos (nome, tipo, ano_lancamento, genero) VALUES
  ('Cidade de Deus', 'filme', 2002, 'Drama'),
  ('Central do Brasil', 'filme', 1998, 'Drama'),
  ('O Auto da Compadecida', 'filme', 2000, 'Comédia'),
  ('Ainda Estou Aqui', 'filme', 2024, 'Drama'),
  ('A Viagem de Chihiro', 'filme', 2001, 'Animação'),
  ('Parasita', 'filme', 2019, 'Suspense'),
  ('Interestelar', 'filme', 2014, 'Ficção científica'),
  ('Duna: Parte Dois', 'filme', 2024, 'Ficção científica'),
  ('Breaking Bad', 'serie', 2008, 'Drama'),
  ('Stranger Things', 'serie', 2016, 'Ficção científica'),
  ('Round 6', 'serie', 2021, 'Suspense'),
  ('Sintonia', 'serie', 2019, 'Drama');