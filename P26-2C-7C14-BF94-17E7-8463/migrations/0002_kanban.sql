-- Migração 0002 — Cartões do Quadro Kanban Pessoal
-- Cloudflare D1 (SQLite) — chave do projeto: P26-2C-7C14-BF94-17E7-8463
-- A migração 0001_init.sql permanece intacta.

CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'media',
  coluna TEXT NOT NULL DEFAULT 'a-fazer',
  posicao INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cards_user_coluna_posicao
  ON cards (user_id, coluna, posicao);
