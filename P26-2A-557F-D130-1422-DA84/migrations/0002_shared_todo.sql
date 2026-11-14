-- Projeto #15 · Shared To-Do · usa discord_users (criada na 0001) como tabela de usuários.
CREATE TABLE IF NOT EXISTS lists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,                       -- código de acesso compartilhável
  owner_id   TEXT NOT NULL REFERENCES discord_users(user_id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS list_members (
  list_id   INTEGER NOT NULL REFERENCES lists(id),
  user_id   TEXT    NOT NULL REFERENCES discord_users(user_id),
  joined_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id     INTEGER NOT NULL REFERENCES lists(id),
  parent_id   INTEGER REFERENCES tasks(id),              -- NULL = tarefa; preenchido = subtarefa
  title       TEXT NOT NULL,
  done        INTEGER NOT NULL DEFAULT 0,
  assignee_id TEXT REFERENCES discord_users(user_id),
  created_by  TEXT NOT NULL REFERENCES discord_users(user_id),
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_list ON tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON list_members(user_id);
