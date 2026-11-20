CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  nome TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  criado_em INTEGER NOT NULL,
  atualizado_em INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessoes (
  id_hash TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  expira_em INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rotas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  motorista_id TEXT NOT NULL REFERENCES usuarios(id),
  origem TEXT NOT NULL,
  destino TEXT NOT NULL,
  data TEXT NOT NULL,
  horario TEXT NOT NULL,
  vagas_totais INTEGER NOT NULL CHECK (vagas_totais BETWEEN 1 AND 8),
  vagas_livres INTEGER NOT NULL CHECK (vagas_livres >= 0 AND vagas_livres <= vagas_totais),
  ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  criado_em INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reservas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rota_id INTEGER NOT NULL REFERENCES rotas(id),
  passageiro_id TEXT NOT NULL REFERENCES usuarios(id),
  criado_em INTEGER NOT NULL,
  UNIQUE (rota_id, passageiro_id)
);

CREATE INDEX IF NOT EXISTS idx_rotas_dia ON rotas (data, ativa, horario);
CREATE INDEX IF NOT EXISTS idx_rotas_motorista ON rotas (motorista_id, ativa);
CREATE INDEX IF NOT EXISTS idx_reservas_passageiro ON reservas (passageiro_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes (expira_em);
