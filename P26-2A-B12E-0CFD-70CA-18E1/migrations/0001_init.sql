-- ============================================================================
-- Projeto #43 — Sorteador Auditável de Equipes e Ordem de Apresentação
-- Chave: P26-2A-B12E-0CFD-70CA-18E1
-- Banco: Cloudflare D1 (SQLite)
--
-- Princípios do schema:
--   1. Toda escrita passa por Cloudflare Pages Functions (nada de confiar no cliente).
--   2. A ata do sorteio é imutável: triggers abortam UPDATE/DELETE em draws.
--   3. Timestamps em ISO-8601 UTC com milissegundos, gerados pela Function.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Usuários importados do Discord OAuth2
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discord_users (
  user_id     TEXT PRIMARY KEY,
  username    TEXT NOT NULL,
  global_name TEXT,
  avatar      TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Sessões opacas: o cookie carrega um token aleatório; o banco guarda só o hash
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ---------------------------------------------------------------------------
-- Salas de sorteio
--   mode = 'groups' -> group_size obrigatório (2..50)
--   mode = 'order'  -> group_size nulo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  id            TEXT PRIMARY KEY,
  public_code   TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  title         TEXT NOT NULL,
  mode          TEXT NOT NULL CHECK (mode IN ('groups', 'order')),
  group_size    INTEGER,
  allow_join    INTEGER NOT NULL DEFAULT 1 CHECK (allow_join IN (0, 1)),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'drawn', 'closed')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  -- `typeof(...) = 'integer'` é necessário: sem ele, um group_size NULL
  -- faria o CHECK avaliar como NULL, e o SQLite aceita CHECK NULL como válido.
  CHECK (
    (mode = 'order'  AND group_size IS NULL) OR
    (mode = 'groups' AND typeof(group_size) = 'integer' AND group_size BETWEEN 2 AND 50)
  ),
  CHECK (length(trim(title)) BETWEEN 3 AND 80),
  CHECK (length(public_code) BETWEEN 6 AND 16)
);

CREATE INDEX IF NOT EXISTS idx_rooms_owner  ON rooms(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

-- ---------------------------------------------------------------------------
-- Participantes
--   Manual:  user_id NULL, source 'manual'
--   Discord: user_id preenchido, source 'discord'
--   UNIQUE(room_id, user_id) impede dupla entrada; vários NULL são permitidos.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS participants (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id          TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id          TEXT REFERENCES discord_users(user_id),
  display_name     TEXT NOT NULL,
  source           TEXT NOT NULL CHECK (source IN ('manual', 'discord')),
  added_by_user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  joined_at        TEXT NOT NULL,
  UNIQUE (room_id, user_id),
  CHECK (
    (source = 'discord' AND user_id IS NOT NULL) OR
    (source = 'manual'  AND user_id IS NULL)
  ),
  CHECK (length(trim(display_name)) BETWEEN 2 AND 60)
);

CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);

-- ---------------------------------------------------------------------------
-- Atas imutáveis dos sorteios (append-only, versionadas por seq)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS draws (
  id                 TEXT PRIMARY KEY,
  room_id            TEXT NOT NULL REFERENCES rooms(id),
  seq                INTEGER NOT NULL CHECK (seq >= 1),
  mode               TEXT NOT NULL CHECK (mode IN ('groups', 'order')),
  params_json        TEXT NOT NULL,
  participants_json  TEXT NOT NULL,
  result_json        TEXT NOT NULL,
  swaps_json         TEXT NOT NULL,
  algorithm          TEXT NOT NULL DEFAULT 'fisher-yates',
  algorithm_version  INTEGER NOT NULL DEFAULT 1,
  audit_hash         TEXT NOT NULL,
  prev_hash          TEXT,
  verification_code  TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  created_at         TEXT NOT NULL,
  UNIQUE (room_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_draws_room ON draws(room_id);
CREATE INDEX IF NOT EXISTS idx_draws_created ON draws(created_at);

-- Resultado normalizado (permite consultar em quais sorteios um aluno apareceu)
CREATE TABLE IF NOT EXISTS draw_entries (
  draw_id        TEXT NOT NULL REFERENCES draws(id) ON DELETE RESTRICT,
  position       INTEGER NOT NULL,
  group_index    INTEGER,
  participant_id INTEGER,
  user_id        TEXT,
  display_name   TEXT NOT NULL,
  PRIMARY KEY (draw_id, position)
);

CREATE INDEX IF NOT EXISTS idx_draw_entries_user ON draw_entries(user_id);

-- ---------------------------------------------------------------------------
-- Imutabilidade física da ata
-- Mesmo com acesso direto ao D1, UPDATE/DELETE são abortados pelo SQLite.
-- ---------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_draws_no_update
BEFORE UPDATE ON draws
BEGIN
  SELECT RAISE(ABORT, 'ata imutavel: draws nao aceita UPDATE');
END;

CREATE TRIGGER IF NOT EXISTS trg_draws_no_delete
BEFORE DELETE ON draws
BEGIN
  SELECT RAISE(ABORT, 'ata imutavel: draws nao aceita DELETE');
END;

CREATE TRIGGER IF NOT EXISTS trg_draw_entries_no_update
BEFORE UPDATE ON draw_entries
BEGIN
  SELECT RAISE(ABORT, 'ata imutavel: draw_entries nao aceita UPDATE');
END;

CREATE TRIGGER IF NOT EXISTS trg_draw_entries_no_delete
BEFORE DELETE ON draw_entries
BEGIN
  SELECT RAISE(ABORT, 'ata imutavel: draw_entries nao aceita DELETE');
END;
