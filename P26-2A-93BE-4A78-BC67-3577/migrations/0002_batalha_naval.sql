-- Migration 0002: modelo do jogo Batalha Naval Tático (Projeto #3)
-- Jogo: jogador (conta Discord) contra o computador, malha 10x10 (linhas/colunas 0..9).
-- Regras de negócio são validadas nas Cloudflare Functions; os CHECK/UNIQUE
-- abaixo são a segunda barreira, para o banco nunca aceitar estado inválido.

-- Sessões de login (substitui o cookie com JSON em base64, que era forjável).
-- O cookie guarda só o "id" (token aleatório); o servidor busca o user_id aqui.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES discord_users(user_id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Partidas. Cada partida pertence a um jogador (user_id do Discord).
CREATE TABLE IF NOT EXISTS games (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES discord_users(user_id),
  status      TEXT NOT NULL DEFAULT 'posicionando'
              CHECK (status IN ('posicionando', 'em_combate', 'finalizada')),
  turn        TEXT NOT NULL DEFAULT 'player'
              CHECK (turn IN ('player', 'cpu')),
  winner      TEXT CHECK (winner IN ('player', 'cpu')),
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_games_user_status ON games(user_id, status);

-- Navios de cada lado da partida. A posição fica só no servidor:
-- a API nunca devolve os navios do computador ao cliente.
CREATE TABLE IF NOT EXISTS ships (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  owner       TEXT NOT NULL CHECK (owner IN ('player', 'cpu')),
  name        TEXT NOT NULL,
  size        INTEGER NOT NULL CHECK (size BETWEEN 2 AND 5),
  row         INTEGER NOT NULL CHECK (row BETWEEN 0 AND 9),
  col         INTEGER NOT NULL CHECK (col BETWEEN 0 AND 9),
  orientation TEXT NOT NULL CHECK (orientation IN ('H', 'V')),
  hits        INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
  UNIQUE (game_id, owner, name)
);
CREATE INDEX IF NOT EXISTS idx_ships_game_owner ON ships(game_id, owner);

-- Disparos. O UNIQUE impede atirar duas vezes na mesma coordenada.
-- result usa exatamente os três valores da especificação.
CREATE TABLE IF NOT EXISTS shots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id    INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  shooter    TEXT NOT NULL CHECK (shooter IN ('player', 'cpu')),
  row        INTEGER NOT NULL CHECK (row BETWEEN 0 AND 9),
  col        INTEGER NOT NULL CHECK (col BETWEEN 0 AND 9),
  result     TEXT NOT NULL CHECK (result IN ('agua', 'acerto', 'afundado')),
  ship_id    INTEGER REFERENCES ships(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (game_id, shooter, row, col)
);
CREATE INDEX IF NOT EXISTS idx_shots_game ON shots(game_id);

-- Placar geral, atualizado quando uma partida termina.
CREATE TABLE IF NOT EXISTS scores (
  user_id      TEXT PRIMARY KEY REFERENCES discord_users(user_id),
  games_played INTEGER NOT NULL DEFAULT 0,
  wins         INTEGER NOT NULL DEFAULT 0,
  losses       INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
