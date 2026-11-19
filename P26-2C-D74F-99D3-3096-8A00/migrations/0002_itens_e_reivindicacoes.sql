-- Migration number: 0002 	 2026-11-17T22:23:36.956Z
CREATE TABLE IF NOT EXISTS items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL CHECK (type IN ('perdi','encontrei')),
  category    TEXT NOT NULL CHECK (category IN ('eletronicos','documentos','garrafas','vestuario')),
  title       TEXT NOT NULL,
  location    TEXT NOT NULL,
  event_date  TEXT NOT NULL,
  description TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','encerrado')),
  owner_id    TEXT NOT NULL REFERENCES discord_users(user_id),
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS claims (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id          INTEGER NOT NULL REFERENCES items(id),
  claimant_id      TEXT NOT NULL REFERENCES discord_users(user_id),
  claimant_contact TEXT NOT NULL,
  owner_contact    TEXT,
  message          TEXT,
  status           TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aceita','recusada','encerrada')),
  created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_filter ON items(type, category, status);
CREATE INDEX IF NOT EXISTS idx_items_owner  ON items(owner_id);
CREATE INDEX IF NOT EXISTS idx_claims_item  ON claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_user  ON claims(claimant_id);

-- impede duas reivindicações pendentes do mesmo usuário no mesmo item
CREATE UNIQUE INDEX IF NOT EXISTS uq_claim_pendente
  ON claims(item_id, claimant_id) WHERE status = 'pendente';