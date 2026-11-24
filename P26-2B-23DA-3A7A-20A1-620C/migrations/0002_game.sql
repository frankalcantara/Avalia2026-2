-- Migration 0002: tabelas do jogo da memoria (codigo <-> saida)

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES discord_users(user_id),
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES discord_users(user_id),
  total_pairs   INTEGER NOT NULL,
  matched_pairs INTEGER NOT NULL DEFAULT 0,
  moves         INTEGER NOT NULL DEFAULT 0,
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  duration_ms   INTEGER,
  efficiency    REAL,
  status        TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS game_cards (
  game_id       TEXT NOT NULL REFERENCES games(id),
  card_id       TEXT NOT NULL,
  pair_key      TEXT NOT NULL,
  kind          TEXT NOT NULL,
  content       TEXT NOT NULL,
  position      INTEGER NOT NULL,
  matched       INTEGER NOT NULL DEFAULT 0,
  turn_revealed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (game_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_games_rank ON games(status, efficiency);