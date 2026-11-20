-- Jogo da Memória: partidas e cartas (P26-2C-50B3-F413-07FD-8793)
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  total_pairs INTEGER NOT NULL,
  matched_pairs INTEGER NOT NULL DEFAULT 0,
  moves INTEGER NOT NULL DEFAULT 0,
  efficiency REAL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id, status);

-- pair_key e content ficam somente no servidor até a carta ser virada
CREATE TABLE IF NOT EXISTS game_cards (
  game_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  pair_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  revealed INTEGER NOT NULL DEFAULT 0,
  matched INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (game_id, card_id)
);
