-- Projeto #24 — Plataforma de Empréstimo e Troca de Livros Físicos
-- Chave: P26-2C-BF60-C440-6484-80FA
-- Esquema relacional Cloudflare D1 (SQLite)

PRAGMA foreign_keys = ON;

-- Usuários importados do Discord OAuth2 (user_id, nome e avatar)
CREATE TABLE IF NOT EXISTS users (
  user_id      TEXT PRIMARY KEY,             -- snowflake do Discord
  username     TEXT NOT NULL,                -- handle único do Discord (contato)
  display_name TEXT,                         -- global_name do Discord
  avatar_url   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessões opacas no servidor (o cookie guarda apenas um token aleatório)
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Inventário de livros
CREATE TABLE IF NOT EXISTS books (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    TEXT NOT NULL REFERENCES users(user_id),
  title       TEXT NOT NULL,
  author      TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('tecnico', 'literario')),
  mode        TEXT NOT NULL DEFAULT 'ambos' CHECK (mode IN ('emprestimo', 'troca', 'ambos')),
  condition   TEXT NOT NULL DEFAULT 'bom' CHECK (condition IN ('novo', 'bom', 'usado', 'desgastado')),
  isbn        TEXT,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'Disponível' CHECK (status IN ('Disponível', 'Reservado', 'Emprestado')),
  holder_id   TEXT REFERENCES users(user_id),  -- quem está com o exemplar (quando Emprestado)
  due_date    TEXT,                            -- data prevista para devolução (YYYY-MM-DD)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_books_owner  ON books(owner_id);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);

-- Pedidos de empréstimo / troca
CREATE TABLE IF NOT EXISTS requests (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  requester_id    TEXT NOT NULL REFERENCES users(user_id),
  owner_id        TEXT NOT NULL REFERENCES users(user_id),  -- dono no momento do pedido
  type            TEXT NOT NULL CHECK (type IN ('emprestimo', 'troca')),
  offered_book_id INTEGER REFERENCES books(id) ON DELETE SET NULL, -- livro oferecido na troca
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'aprovado', 'recusado', 'cancelado', 'devolvido', 'concluido')),
  due_date        TEXT,      -- definido pelo dono ao aprovar um empréstimo
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at      TEXT,
  returned_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_book      ON requests(book_id);
CREATE INDEX IF NOT EXISTS idx_requests_requester ON requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_owner     ON requests(owner_id);
-- No máximo um pedido pendente por livro (o livro fica Reservado)
CREATE UNIQUE INDEX IF NOT EXISTS uq_requests_pending_book
  ON requests(book_id) WHERE status = 'pendente';
