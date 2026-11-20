CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('meeting_room', 'study_cabin', 'lab_bench')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

INSERT OR IGNORE INTO resources (id, name, kind) VALUES
  ('meeting-a', 'Sala de reunião A', 'meeting_room'),
  ('meeting-b', 'Sala de reunião B', 'meeting_room'),
  ('study-1', 'Cabine de estudo 1', 'study_cabin'),
  ('study-2', 'Cabine de estudo 2', 'study_cabin'),
  ('lab-1', 'Bancada de laboratório 1', 'lab_bench'),
  ('lab-2', 'Bancada de laboratório 2', 'lab_bench');

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  local_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (30, 60, 90, 120)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_reservations_resource_day
  ON reservations(resource_id, local_date, status, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_reservations_user_day
  ON reservations(user_id, local_date, status);
