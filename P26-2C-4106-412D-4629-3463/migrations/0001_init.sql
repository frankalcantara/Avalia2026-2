-- Cloudflare D1 (SQLite). Rode no Console do D1 ou com: wrangler d1 execute mural-avisos --remote --file=migrations/0001_init.sql
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,          -- user_id do Discord
  username    TEXT NOT NULL,
  global_name TEXT,
  avatar      TEXT,                      -- hash do avatar no Discord
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,           -- SHA-256 do token opaco do cookie
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS disciplinas (
  codigo     TEXT PRIMARY KEY,
  nome       TEXT NOT NULL,
  criado_por TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inscricoes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  codigo  TEXT NOT NULL REFERENCES disciplinas(codigo) ON DELETE CASCADE,
  PRIMARY KEY (user_id, codigo)
);

CREATE TABLE IF NOT EXISTS avisos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  disciplina   TEXT NOT NULL REFERENCES disciplinas(codigo) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('aviso','lembrete','link')),
  titulo       TEXT NOT NULL,
  corpo        TEXT NOT NULL DEFAULT '',
  url          TEXT,
  prazo        TEXT,                     -- AAAA-MM-DD (lembretes)
  autor_id     TEXT NOT NULL REFERENCES users(id),   -- extraído do OAuth2 do Discord
  autor_nome   TEXT NOT NULL,                        -- nome público no momento da postagem
  autor_avatar TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_avisos_disc ON avisos(disciplina, created_at DESC);

-- Estado individual: "lido" e "fixado" valem só para cada usuário.
CREATE TABLE IF NOT EXISTS estado_aviso (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aviso_id INTEGER NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,
  lido     INTEGER NOT NULL DEFAULT 0,
  fixado   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, aviso_id)
);
