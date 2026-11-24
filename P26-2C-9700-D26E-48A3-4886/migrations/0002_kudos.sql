CREATE TABLE IF NOT EXISTS kudos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  badge TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (from_id <> to_id),
  FOREIGN KEY (from_id) REFERENCES discord_users(user_id),
  FOREIGN KEY (to_id) REFERENCES discord_users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_kudos_from ON kudos(from_id);
CREATE INDEX IF NOT EXISTS idx_kudos_to ON kudos(to_id);
CREATE INDEX IF NOT EXISTS idx_kudos_created ON kudos(created_at);
