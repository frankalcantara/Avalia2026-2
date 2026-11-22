-- Memorize · Esquema D1 (SQLite)
-- Chave: P26-2A-DF64-8C37-3512-F974

-- Estudantes identificados pelo Discord (user_id, nome de usuário e avatar).
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,              -- Discord user_id (snowflake)
  username        TEXT NOT NULL,
  global_name     TEXT,
  avatar          TEXT,                          -- hash do avatar no CDN do Discord
  timezone        TEXT,                          -- fuso usado para definir o "hoje" da fila
  tz_updated_at   INTEGER,                       -- epoch ms (troca de fuso no máx. 1x/24h)
  created_at      TEXT NOT NULL,
  last_login_at   TEXT NOT NULL
);

-- Sessões do lado do servidor. O cookie guarda um token aleatório;
-- o banco guarda apenas o SHA-256 desse token.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,                  -- epoch ms
  expires_at  INTEGER NOT NULL                   -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Baralhos pessoais de cada estudante.
CREATE TABLE IF NOT EXISTS decks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  description  TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 300),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id);

-- Cartões com o estado do algoritmo de repetição espaçada (SM-2 simplificado).
CREATE TABLE IF NOT EXISTS cards (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  deck_id           INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  front             TEXT NOT NULL CHECK (length(front) BETWEEN 1 AND 1000),
  back              TEXT NOT NULL CHECK (length(back) BETWEEN 1 AND 1000),
  ease_factor       REAL NOT NULL DEFAULT 2.5 CHECK (ease_factor >= 1.3),
  interval_days     INTEGER NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  repetitions       INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  due_date          TEXT NOT NULL,               -- data da próxima revisão (YYYY-MM-DD)
  last_reviewed_at  TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cards_user_due ON cards(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);

-- Histórico de avaliações (auditoria + limite diário de cartões novos + sequência de dias).
-- Apagar cartão/baralho preserva o histórico (SET NULL), para não "devolver" a cota diária.
CREATE TABLE IF NOT EXISTS reviews (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id            INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  deck_id            INTEGER REFERENCES decks(id) ON DELETE SET NULL,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating             TEXT NOT NULL CHECK (rating IN ('hard', 'good', 'easy')),
  quality            INTEGER NOT NULL CHECK (quality BETWEEN 3 AND 5),
  was_new            INTEGER NOT NULL DEFAULT 0,
  prev_interval      INTEGER NOT NULL,
  new_interval       INTEGER NOT NULL,
  prev_ease          REAL NOT NULL,
  new_ease           REAL NOT NULL,
  review_date        TEXT NOT NULL,              -- dia local do estudante (YYYY-MM-DD)
  reviewed_at        TEXT NOT NULL               -- timestamp ISO (UTC)
);
CREATE INDEX IF NOT EXISTS idx_reviews_user_date ON reviews(user_id, review_date);
CREATE INDEX IF NOT EXISTS idx_reviews_deck_date ON reviews(deck_id, review_date);
