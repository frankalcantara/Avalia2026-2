-- Vitrine de Achados e Perdidos do Campus (Projeto #34) — chave P26-3A-5E56-230D-1716-D540
-- Esquema inicial do Cloudflare D1 (SQLite). Contrato: docs/ESPECIFICACAO.md, seção 2.
-- Datas: texto UTC no formato do SQLite, datetime('now') -> 'YYYY-MM-DD HH:MM:SS'.
-- Tamanhos com length(): o SQLite conta caracteres (code points), igual ao validador em
-- functions/_lib/validacao.js, que conta com [...texto].length.

CREATE TABLE usuarios (
  user_id        TEXT PRIMARY KEY CHECK (length(user_id) BETWEEN 1 AND 32 AND user_id NOT GLOB '*[^0-9]*'),
  username       TEXT NOT NULL CHECK (length(username) BETWEEN 1 AND 64),
  nome_exibicao  TEXT NOT NULL CHECK (length(nome_exibicao) BETWEEN 1 AND 64),
  avatar_url     TEXT NOT NULL CHECK (avatar_url LIKE 'https://cdn.discordapp.com/%' AND length(avatar_url) <= 200),
  criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Guarda só o SHA-256 (hex minúsculo, 64 chars) do token do cookie "sessao"; nunca o token.
CREATE TABLE sessoes (
  token_hash  TEXT PRIMARY KEY CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  user_id     TEXT NOT NULL REFERENCES usuarios(user_id) ON DELETE CASCADE,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now')),
  expira_em   TEXT NOT NULL
);
CREATE INDEX idx_sessoes_user ON sessoes(user_id);

CREATE TABLE itens (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  autor_id         TEXT NOT NULL REFERENCES usuarios(user_id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL CHECK (tipo IN ('perdi', 'encontrei')),
  categoria        TEXT NOT NULL CHECK (categoria IN ('eletronicos', 'documentos', 'garrafas', 'vestuario')),
  titulo           TEXT NOT NULL CHECK (length(titulo) BETWEEN 3 AND 80),
  descricao        TEXT NOT NULL CHECK (length(descricao) BETWEEN 10 AND 1000),
  local            TEXT NOT NULL CHECK (length(local) BETWEEN 3 AND 120),
  data_ocorrencia  TEXT NOT NULL CHECK (
                     data_ocorrencia GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
                     AND date(data_ocorrencia) = data_ocorrencia
                   ),
  status           TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_devolucao', 'encerrado')),
  criado_em        TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em    TEXT NOT NULL DEFAULT (datetime('now')),
  encerrado_em     TEXT,
  CHECK ((status = 'encerrado') = (encerrado_em IS NOT NULL))
);
CREATE INDEX idx_itens_status_criado ON itens(status, criado_em);
CREATE INDEX idx_itens_autor_criado  ON itens(autor_id, criado_em);
CREATE INDEX idx_itens_data          ON itens(data_ocorrencia);

CREATE TABLE reivindicacoes (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id                INTEGER NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
  reivindicante_id       TEXT NOT NULL REFERENCES usuarios(user_id) ON DELETE CASCADE,
  mensagem               TEXT NOT NULL CHECK (length(mensagem) BETWEEN 10 AND 500),
  status                 TEXT NOT NULL DEFAULT 'pendente'
                           CHECK (status IN ('pendente', 'aceita', 'recusada', 'cancelada', 'concluida')),
  contato_autor          TEXT NOT NULL CHECK (length(contato_autor) BETWEEN 1 AND 64),
  contato_reivindicante  TEXT NOT NULL CHECK (length(contato_reivindicante) BETWEEN 1 AND 64),
  criado_em              TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reiv_item          ON reivindicacoes(item_id, status);
CREATE INDEX idx_reiv_reivindicante ON reivindicacoes(reivindicante_id, atualizado_em);

-- No máximo UMA reivindicação ativa (pendente/aceita) do mesmo usuário no mesmo item.
CREATE UNIQUE INDEX uq_reiv_ativa_por_usuario
  ON reivindicacoes(item_id, reivindicante_id)
  WHERE status IN ('pendente', 'aceita');

-- No máximo UMA reivindicação aceita por item (defesa extra contra corrida no "aceitar").
CREATE UNIQUE INDEX uq_reiv_aceita_por_item
  ON reivindicacoes(item_id)
  WHERE status = 'aceita';
