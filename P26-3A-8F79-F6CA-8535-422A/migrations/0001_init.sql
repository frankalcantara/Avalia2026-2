-- Esquema D1 do projeto #15 Shared To-Do (P26-3A-8F79-F6CA-8535-422A). Contrato em docs/API.md.
-- Datas em ISO 8601 UTC ("2026-11-20T20:00:00Z").

CREATE TABLE users (
  user_id    TEXT PRIMARY KEY,
  username   TEXT NOT NULL,
  avatar     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE lists (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  share_code TEXT NOT NULL UNIQUE,
  owner_id   TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE list_members (
  list_id   INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (list_id, user_id)
);

CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY,
  list_id     INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  parent_id   INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  assignee_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  created_by  TEXT NOT NULL REFERENCES users(user_id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- "Minhas listas" parte de list_members por user_id (a PK já cobre list_id).
CREATE INDEX idx_list_members_user ON list_members(user_id);
CREATE INDEX idx_tasks_list ON tasks(list_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
