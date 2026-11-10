-- Esquema Cloudflare D1 — P26-2C-6D8F-984C-AF8F-2CA8 (Projeto #17: Calculadora e Simulador de Desempenho Acadêmico)

-- Perfil importado do Discord OAuth2 (user_id, nome, avatar)
CREATE TABLE IF NOT EXISTS discord_users (
  user_id    TEXT PRIMARY KEY,
  username   TEXT NOT NULL,
  avatar     TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sessão opaca no servidor: o cookie guarda só um token aleatório; o user_id nunca vem do cliente.
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Disciplina do semestre com as regras de aprovação
CREATE TABLE IF NOT EXISTS disciplinas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  nome            TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 80),
  nota_max        REAL NOT NULL DEFAULT 10 CHECK (nota_max > 0),
  media_aprovacao REAL NOT NULL DEFAULT 7,
  media_exame     REAL NOT NULL DEFAULT 4,
  media_final     REAL NOT NULL DEFAULT 5,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (media_exame <= media_aprovacao)
);
CREATE INDEX IF NOT EXISTS idx_disciplinas_user ON disciplinas(user_id);

-- Avaliações (provas, trabalhos, listas) com peso e nota (NULL = ainda não realizada)
CREATE TABLE IF NOT EXISTS avaliacoes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
  ordem         INTEGER NOT NULL,
  nome          TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 60),
  tipo          TEXT NOT NULL CHECK (tipo IN ('prova', 'trabalho', 'lista')),
  peso          REAL NOT NULL CHECK (peso > 0),
  nota          REAL CHECK (nota IS NULL OR nota >= 0)
);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_disciplina ON avaliacoes(disciplina_id);
