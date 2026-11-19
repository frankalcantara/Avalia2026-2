-- Eventos criados por usuários autenticados via Discord
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL REFERENCES discord_users(user_id),
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Inscrições: confirmadas ou na fila de espera (ordenada por created_at, id)
CREATE TABLE IF NOT EXISTS rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'waitlist')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date, event_time);
CREATE INDEX IF NOT EXISTS idx_rsvps_event_status ON rsvps(event_id, status, created_at, id);