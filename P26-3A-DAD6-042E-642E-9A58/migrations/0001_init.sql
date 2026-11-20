-- Esquema do Gerenciador de Eventos e Controle de Presença (RSVP)
-- Chave: P26-3A-DAD6-042E-642E-9A58
-- Datas de sistema em milissegundos desde a época (Unix ms).


-- Perfil importado do Discord (user_id, nome de usuário e avatar).
CREATE TABLE IF NOT EXISTS discord_users (
  user_id      TEXT PRIMARY KEY,           -- id (snowflake) do Discord
  username     TEXT NOT NULL,
  global_name  TEXT,                       -- nome de exibição, se houver
  avatar       TEXT,                       -- hash do avatar (pode ser NULL)
  updated_at   INTEGER NOT NULL
);

-- Transações OAuth de uso único (proteção contra CSRF no login).
CREATE TABLE IF NOT EXISTS oauth_states (
  id_hash     TEXT PRIMARY KEY,            -- SHA-256 do cookie __Host-oauth-tx
  state_hash  TEXT NOT NULL,               -- SHA-256 do parâmetro state
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states (expires_at);

-- Sessões opacas: o D1 guarda só o resumo do cookie, nunca o valor.
CREATE TABLE IF NOT EXISTS sessions (
  id_hash     TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES discord_users (user_id),
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expires_at);

-- Eventos (palestras, grupos de estudo, encontros acadêmicos).
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id   TEXT NOT NULL REFERENCES discord_users (user_id),
  title        TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description  TEXT CHECK (description IS NULL OR length(description) <= 2000),
  location     TEXT NOT NULL CHECK (length(location) BETWEEN 2 AND 120),
  event_date   TEXT NOT NULL,              -- AAAA-MM-DD (horário de Brasília)
  event_time   TEXT NOT NULL,              -- HH:MM
  capacity     INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 10000),
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events (event_date, event_time);

-- Inscrições: confirmadas ou em fila de espera ordenada por requested_at.
CREATE TABLE IF NOT EXISTS registrations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id      INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES discord_users (user_id),
  status        TEXT NOT NULL CHECK (status IN ('confirmed', 'waitlist')),
  requested_at  INTEGER NOT NULL,          -- horário da solicitação (ordem da fila)
  promoted_at   INTEGER,                   -- quando saiu da fila para confirmado
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_registrations_queue
  ON registrations (event_id, status, requested_at, id);
