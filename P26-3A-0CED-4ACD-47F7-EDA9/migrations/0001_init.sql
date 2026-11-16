-- Cypher (P26-3A-0CED-4ACD-47F7-EDA9) - esquema inicial do Cloudflare D1

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  global_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Guarda apenas o SHA-256 do token de sessão
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS user_guilds (
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  guild_name TEXT NOT NULL,
  guild_icon TEXT,
  PRIMARY KEY (user_id, guild_id)
);
CREATE INDEX IF NOT EXISTS idx_user_guilds_guild ON user_guilds(guild_id);

-- Palavra sorteada por slot (slot = 2 * dias desde o lançamento + offset do modo)
CREATE TABLE IF NOT EXISTS daily_words (
  slot INTEGER PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('classico', 'sombra')),
  day TEXT NOT NULL,
  word_key TEXT NOT NULL,
  cycle INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (mode, day)
);

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('classico', 'sombra')),
  day TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'won', 'lost')),
  attempts INTEGER NOT NULL DEFAULT 0,
  is_archive INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  UNIQUE (user_id, mode, day)
);
CREATE INDEX IF NOT EXISTS idx_games_user_mode ON games(user_id, mode);

-- A chave primária impede gravar duas tentativas com o mesmo número
CREATE TABLE IF NOT EXISTS guesses (
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL,
  guess TEXT NOT NULL,
  feedback TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (game_id, attempt_no)
);

-- Estatísticas consolidadas por usuário e modo
CREATE TABLE IF NOT EXISTS user_stats (
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  max_streak INTEGER NOT NULL DEFAULT 0,
  last_win_day TEXT,
  distribution TEXT NOT NULL DEFAULT '[]',
  win_attempts_total INTEGER NOT NULL DEFAULT 0,
  archive_played INTEGER NOT NULL DEFAULT 0,
  archive_wins INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, mode)
);
CREATE INDEX IF NOT EXISTS idx_user_stats_mode ON user_stats(mode);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  word_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON challenges(creator_id, created_at);

CREATE TABLE IF NOT EXISTS challenge_games (
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'won', 'lost')),
  attempts INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  PRIMARY KEY (challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS challenge_guesses (
  challenge_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  guess TEXT NOT NULL,
  feedback TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (challenge_id, user_id, attempt_no)
);
