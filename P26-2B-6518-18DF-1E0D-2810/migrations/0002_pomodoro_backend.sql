ALTER TABLE discord_users ADD COLUMN global_name TEXT;

CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_oauth_states_expires_at ON oauth_states(expires_at);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  UNIQUE (user_id, id)
);

CREATE UNIQUE INDEX idx_subjects_active_name
  ON subjects(user_id, lower(name))
  WHERE archived_at IS NULL;
CREATE INDEX idx_subjects_owner ON subjects(user_id, archived_at);

CREATE TABLE pomodoro_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds BETWEEN 60 AND 7200),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'cancelled')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  cancelled_at TEXT,
  FOREIGN KEY (user_id, subject_id) REFERENCES subjects(user_id, id) ON DELETE RESTRICT,
  UNIQUE (user_id, idempotency_key),
  CHECK (
    (status = 'running' AND completed_at IS NULL AND cancelled_at IS NULL) OR
    (status = 'completed' AND completed_at IS NOT NULL AND cancelled_at IS NULL) OR
    (status = 'cancelled' AND completed_at IS NULL AND cancelled_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_pomodoro_one_running_per_user
  ON pomodoro_cycles(user_id)
  WHERE status = 'running';
CREATE INDEX idx_pomodoro_completed_week
  ON pomodoro_cycles(user_id, status, completed_at);
CREATE INDEX idx_pomodoro_subject ON pomodoro_cycles(user_id, subject_id);