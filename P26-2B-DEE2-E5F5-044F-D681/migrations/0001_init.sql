-- Vitrine de Achados e Perdidos do Campus
-- Projeto #34 · Chave P26-2B-DEE2-E5F5-044F-D681
-- Esquema relacional do Cloudflare D1 (SQLite)

-- Usuários importados do Discord via OAuth2 (user_id, nome e avatar)
CREATE TABLE IF NOT EXISTS discord_users (
  user_id     TEXT PRIMARY KEY,                 -- id (snowflake) do Discord
  username    TEXT NOT NULL,                    -- @username do Discord (contato)
  global_name TEXT,                             -- nome de exibição
  avatar      TEXT,                             -- hash do avatar (pode ser NULL)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessões de login (o cookie guarda o token; o banco guarda só o SHA-256 dele)
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Itens reportados: "perdi" (procuro) ou "encontrei" (achei e quero devolver)
CREATE TABLE IF NOT EXISTS items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo            TEXT NOT NULL CHECK (tipo IN ('perdi', 'encontrei')),
  categoria       TEXT NOT NULL CHECK (categoria IN ('eletronicos', 'documentos', 'garrafas', 'vestuario')),
  titulo          TEXT NOT NULL CHECK (length(titulo) BETWEEN 3 AND 80),
  local           TEXT NOT NULL CHECK (length(local) BETWEEN 3 AND 120),
  data_ocorrencia TEXT NOT NULL,                -- AAAA-MM-DD
  descricao       TEXT NOT NULL CHECK (length(descricao) BETWEEN 10 AND 1000),
  status          TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_devolucao', 'encerrado')),
  owner_id        TEXT NOT NULL REFERENCES discord_users(user_id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_filtros ON items(status, tipo, categoria);
CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);

-- Reivindicações: guardam o contato do Discord das DUAS partes para a devolução
CREATE TABLE IF NOT EXISTS claims (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id            INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  owner_id           TEXT NOT NULL REFERENCES discord_users(user_id),   -- quem publicou o item
  claimant_id        TEXT NOT NULL REFERENCES discord_users(user_id),   -- quem abriu a reivindicação
  owner_contact      TEXT NOT NULL,             -- @username do Discord de quem publicou
  claimant_contact   TEXT NOT NULL,             -- @username do Discord de quem reivindicou
  mensagem           TEXT NOT NULL CHECK (length(mensagem) BETWEEN 10 AND 500),
  status             TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente', 'aceita', 'recusada', 'cancelada', 'concluida')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (owner_id <> claimant_id)
);
CREATE INDEX IF NOT EXISTS idx_claims_item ON claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_owner ON claims(owner_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant ON claims(claimant_id);
-- Um usuário só pode ter UMA reivindicação ativa por item
CREATE UNIQUE INDEX IF NOT EXISTS uq_claim_ativa
  ON claims(item_id, claimant_id) WHERE status IN ('pendente', 'aceita');
