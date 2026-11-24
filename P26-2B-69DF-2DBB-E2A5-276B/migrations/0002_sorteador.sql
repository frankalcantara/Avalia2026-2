CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY,
  return_to TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES discord_users(user_id),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
  mode TEXT NOT NULL CHECK(mode IN ('equipes','ordem')),
  max_size INTEGER NOT NULL CHECK(max_size BETWEEN 1 AND 100),
  created_at TEXT NOT NULL
);
CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  user_id TEXT REFERENCES discord_users(user_id),
  created_at TEXT NOT NULL,
  UNIQUE(room_id,user_id)
);
CREATE INDEX participants_room ON participants(room_id);
CREATE TABLE draws (
  code TEXT PRIMARY KEY,
  room_id TEXT NOT NULL UNIQUE REFERENCES rooms(id),
  payload TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TRIGGER draws_no_update BEFORE UPDATE ON draws BEGIN SELECT RAISE(ABORT,'Ata imutável'); END;
CREATE TRIGGER draws_no_delete BEFORE DELETE ON draws BEGIN SELECT RAISE(ABORT,'Ata imutável'); END;
CREATE TRIGGER participants_frozen_insert BEFORE INSERT ON participants WHEN EXISTS(SELECT 1 FROM draws WHERE room_id=NEW.room_id) BEGIN SELECT RAISE(ABORT,'Sorteio encerrado'); END;
CREATE TRIGGER participants_frozen_update BEFORE UPDATE ON participants WHEN EXISTS(SELECT 1 FROM draws WHERE room_id=OLD.room_id) BEGIN SELECT RAISE(ABORT,'Sorteio encerrado'); END;
CREATE TRIGGER participants_frozen_delete BEFORE DELETE ON participants WHEN EXISTS(SELECT 1 FROM draws WHERE room_id=OLD.room_id) BEGIN SELECT RAISE(ABORT,'Sorteio encerrado'); END;
CREATE TRIGGER participants_limit BEFORE INSERT ON participants WHEN (SELECT COUNT(*) FROM participants WHERE room_id=NEW.room_id)>=500 BEGIN SELECT RAISE(ABORT,'Limite de participantes'); END;
CREATE TRIGGER rooms_frozen_update BEFORE UPDATE ON rooms WHEN EXISTS(SELECT 1 FROM draws WHERE room_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Sorteio encerrado'); END;
CREATE TRIGGER rooms_frozen_delete BEFORE DELETE ON rooms WHEN EXISTS(SELECT 1 FROM draws WHERE room_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Sorteio encerrado'); END;
