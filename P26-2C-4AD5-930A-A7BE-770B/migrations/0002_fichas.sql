CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL REFERENCES discord_users(user_id),
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  race TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 20),
  forca INTEGER NOT NULL CHECK (forca BETWEEN 1 AND 30),
  destreza INTEGER NOT NULL CHECK (destreza BETWEEN 1 AND 30),
  constituicao INTEGER NOT NULL CHECK (constituicao BETWEEN 1 AND 30),
  inteligencia INTEGER NOT NULL CHECK (inteligencia BETWEEN 1 AND 30),
  sabedoria INTEGER NOT NULL CHECK (sabedoria BETWEEN 1 AND 30),
  carisma INTEGER NOT NULL CHECK (carisma BETWEEN 1 AND 30),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roll_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  username TEXT NOT NULL,
  character_id INTEGER NOT NULL REFERENCES characters(id),
  attribute TEXT NOT NULL,
  die TEXT NOT NULL CHECK (die IN ('d4', 'd6', 'd8', 'd10', 'd12', 'd20')),
  result INTEGER NOT NULL,
  modifier INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_characters_owner_id ON characters(owner_id);
CREATE INDEX IF NOT EXISTS idx_roll_log_created_at ON roll_log(created_at);
