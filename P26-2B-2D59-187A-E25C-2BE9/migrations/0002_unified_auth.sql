CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  discord_id TEXT UNIQUE,
  email TEXT COLLATE NOCASE UNIQUE,
  username TEXT NOT NULL,
  avatar TEXT,
  password_salt TEXT,
  password_hash TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (id, discord_id, username, avatar, updated_at)
SELECT user_id, user_id, username, avatar, updated_at
FROM discord_users;

ALTER TABLE items
  ADD COLUMN responsible_agent TEXT NOT NULL DEFAULT 'Almoxarifado';

CREATE TABLE movements_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('withdrawal', 'return')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

INSERT INTO movements_new (id, item_id, type, quantity, user_id, username, created_at)
SELECT id, item_id, type, quantity, user_id, username, created_at
FROM movements;

DROP TABLE movements;
ALTER TABLE movements_new RENAME TO movements;
DROP TABLE discord_users;

CREATE INDEX idx_movements_created_at ON movements(created_at DESC, id DESC);
CREATE INDEX idx_movements_item_id ON movements(item_id);
CREATE INDEX idx_movements_user_id ON movements(user_id);
