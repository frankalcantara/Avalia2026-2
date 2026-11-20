
-- Palavras escolhidas pelo servidor para cada dia
CREATE TABLE IF NOT EXISTS daily_words (
  game_date TEXT PRIMARY KEY,
  word TEXT NOT NULL
);

-- Partidas diárias de cada usuário
CREATE TABLE IF NOT EXISTS user_daily_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  game_date TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'playing'
    CHECK (status IN ('playing', 'won', 'lost')),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, game_date)
);

-- Tentativas realizadas em cada partida
CREATE TABLE IF NOT EXISTS game_guesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  guess_number INTEGER NOT NULL,
  guess TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES user_daily_games(id),
  UNIQUE (game_id, guess_number)
);

-- Estatísticas gerais dos jogadores
CREATE TABLE IF NOT EXISTS user_stats (
  user_id TEXT PRIMARY KEY,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  games_lost INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  max_streak INTEGER NOT NULL DEFAULT 0,
  last_played_date TEXT
);

-- Distribuição das vitórias por quantidade de tentativas
CREATE TABLE IF NOT EXISTS guess_distribution (
  user_id TEXT NOT NULL,
  guess_count INTEGER NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, guess_count)
);

CREATE INDEX IF NOT EXISTS idx_daily_games_user
ON user_daily_games(user_id, game_date);

CREATE INDEX IF NOT EXISTS idx_game_guesses_game
ON game_guesses(game_id);
