-- =====================================================================
-- Chave Única: P26-2A-B560-8204-9850-C4B0
-- Projeto #28 — Livro de Receitas Colaborativo com Escalonador de Porções
-- Migração inicial (0001) — Cloudflare D1 (SQLite)
--
-- Notas de arquitetura (plano gratuito):
--  * Toda coluna usada em WHERE/JOIN/ORDER BY possui índice dedicado.
--  * FKs com ON DELETE CASCADE garantem limpeza sem múltiplos round-trips.
--  * CHECKs impedem gravação de valores fora de faixa mesmo por SQL manual.
-- =====================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS discord_users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  global_name TEXT,
  avatar TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  prep_minutes INTEGER NOT NULL CHECK (prep_minutes BETWEEN 1 AND 1440),
  base_servings INTEGER NOT NULL CHECK (base_servings BETWEEN 1 AND 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  UNIQUE (recipe_id, position)
);

CREATE TABLE IF NOT EXISTS recipe_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  UNIQUE (recipe_id, position)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, recipe_id)
);

-- ---------------------------------------------------------------------
-- Índices (evitam full table scans que multiplicam linhas lidas no D1)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_recipes_user ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_prep_minutes ON recipes(prep_minutes);
CREATE INDEX IF NOT EXISTS idx_recipes_created ON recipes(created_at);
CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes(title COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON recipe_ingredients(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_ingredients_quantity ON recipe_ingredients(quantity);

CREATE INDEX IF NOT EXISTS idx_steps_recipe ON recipe_steps(recipe_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_recipe ON favorites(recipe_id);
