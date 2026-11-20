-- Projeto #38 — Rastreador de Solicitações e Chamados Internos (Issue Tracker)
-- Chave Única: P26-2C-7200-F0C5-B458-DA41
-- Esquema relacional Cloudflare D1 (SQLite)

PRAGMA foreign_keys = ON;

-- Usuários importados do Discord OAuth2 (user_id, nome e avatar)
CREATE TABLE IF NOT EXISTS users (
  user_id     TEXT PRIMARY KEY,                -- id do Discord (snowflake)
  username    TEXT NOT NULL,
  avatar      TEXT,                            -- URL do avatar no CDN do Discord
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Sessões do servidor: o cookie guarda um token aleatório; aqui fica só o SHA-256 dele
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Chamados técnicos
CREATE TABLE IF NOT EXISTS tickets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,           -- identificador único público, ex: CH-7K2M9Q
  title        TEXT NOT NULL CHECK (length(title) BETWEEN 5 AND 120),
  location     TEXT NOT NULL CHECK (length(location) BETWEEN 2 AND 80),   -- laboratório/projeto afetado
  severity     TEXT NOT NULL CHECK (severity IN ('baixa', 'media', 'alta', 'critica')),
  description  TEXT NOT NULL CHECK (length(description) BETWEEN 10 AND 4000),
  status       TEXT NOT NULL DEFAULT 'aberto'
               CHECK (status IN ('aberto', 'em_analise', 'aguardando', 'resolvido')),
  author_id    TEXT NOT NULL REFERENCES users(user_id),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_author   ON tickets(author_id);
CREATE INDEX IF NOT EXISTS idx_tickets_updated  ON tickets(updated_at DESC);

-- Histórico (linha do tempo): abertura, mudanças de estado e comentários técnicos
CREATE TABLE IF NOT EXISTS ticket_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id    INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id    TEXT NOT NULL REFERENCES users(user_id),
  kind         TEXT NOT NULL CHECK (kind IN ('criado', 'status', 'comentario')),
  from_status  TEXT,
  to_status    TEXT,
  body         TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_events_ticket ON ticket_events(ticket_id, id);
