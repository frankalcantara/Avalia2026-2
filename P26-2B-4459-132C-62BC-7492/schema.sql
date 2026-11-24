-- Quiz Competitivo Temporizado — schema Cloudflare D1 (SQLite)
-- Chave Única: P26-2B-4459-132C-62BC-7492
-- Idempotente: pode ser executado mais de uma vez.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,          -- user_id do Discord
  name          TEXT NOT NULL,             -- global_name ou username
  avatar        TEXT,                      -- hash do avatar (pode ser nulo)
  created_at    INTEGER NOT NULL,          -- epoch ms
  last_login_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,             -- SHA-256 hex do token do cookie
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS questions (
  id            TEXT PRIMARY KEY,
  category_id   TEXT NOT NULL REFERENCES categories(id),
  text          TEXT NOT NULL,
  options       TEXT NOT NULL,             -- JSON: array com 4 strings
  correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),  -- NUNCA sai nas rotas de entrega
  time_limit_ms INTEGER NOT NULL DEFAULT 15000
);
CREATE INDEX IF NOT EXISTS idx_questions_cat ON questions(category_id);

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  total       INTEGER NOT NULL,
  score       INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','abandoned')),
  created_at  INTEGER NOT NULL,
  finished_at INTEGER
);
-- Um usuário só pode ter UM quiz ativo (impede dois `start` concorrentes de gerarem dois quizzes ativos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_one_active ON quiz_sessions(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_quiz_user   ON quiz_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_quiz_rank   ON quiz_sessions(category_id, status, score);

CREATE TABLE IF NOT EXISTS quiz_items (
  quiz_id       TEXT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  question_id   TEXT NOT NULL REFERENCES questions(id),
  option_order  TEXT NOT NULL,             -- JSON: permutação de [0,1,2,3] (posição exibida -> índice original)
  time_limit_ms INTEGER NOT NULL,          -- cópia do limite no momento do sorteio
  sent_at       INTEGER,                   -- relógio do servidor: quando a pergunta foi entregue
  answered_at   INTEGER,                   -- relógio do servidor: quando a resposta chegou
  chosen_index  INTEGER,                   -- índice EXIBIDO escolhido
  result        TEXT CHECK (result IN ('correct','wrong','timeout','skipped')),
  elapsed_ms    INTEGER,
  points        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (quiz_id, position)
);
