-- Jogo da Memória (Projeto #7): partidas e cartas, tudo validado no servidor.
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',      -- active | finished | abandoned
  moves INTEGER NOT NULL DEFAULT 0,
  pairs_total INTEGER NOT NULL,
  pairs_found INTEGER NOT NULL DEFAULT 0,
  pending_card TEXT,                          -- primeira carta virada do movimento atual
  efficiency REAL,                            -- pares / movimentos * 100
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS game_cards (
  token TEXT PRIMARY KEY,                     -- identificador opaco enviado ao cliente
  game_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  pair_id INTEGER NOT NULL,                   -- nunca sai do servidor
  kind TEXT NOT NULL,                         -- code | output
  text TEXT NOT NULL,
  matched INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id, status);
CREATE INDEX IF NOT EXISTS idx_cards_game ON game_cards(game_id);
