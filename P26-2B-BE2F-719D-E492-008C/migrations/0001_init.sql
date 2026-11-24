CREATE TABLE jogadores (
  discord_id TEXT PRIMARY KEY,
  username   TEXT NOT NULL,
  avatar     TEXT,
  criado_em  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fichas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id   TEXT NOT NULL REFERENCES jogadores(discord_id),
  nome         TEXT NOT NULL,
  classe       TEXT,
  nivel        INTEGER NOT NULL DEFAULT 1,
  forca        INTEGER NOT NULL,
  destreza     INTEGER NOT NULL,
  constituicao INTEGER NOT NULL,
  inteligencia INTEGER NOT NULL,
  sabedoria    INTEGER NOT NULL,
  carisma      INTEGER NOT NULL,
  criado_em    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rolagens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id  TEXT NOT NULL,
  username    TEXT NOT NULL,
  ficha_id    INTEGER,
  personagem  TEXT,
  atributo    TEXT,
  dado        TEXT NOT NULL,
  resultado   INTEGER NOT NULL,
  modificador INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL,
  criado_em   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_rolagens_data ON rolagens(id DESC);