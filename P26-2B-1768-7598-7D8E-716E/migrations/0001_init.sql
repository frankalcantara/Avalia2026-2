CREATE TABLE IF NOT EXISTS users (
  discord_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  status TEXT NOT NULL,
  player_fleet TEXT,
  enemy_fleet TEXT,
  player_shots TEXT DEFAULT '[]',
  enemy_shots TEXT DEFAULT '[]',
  created_at INTEGER
);