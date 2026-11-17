CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY NOT NULL,
  author_user_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  title_key TEXT NOT NULL CHECK (length(title_key) > 0),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  prep_time INTEGER NOT NULL CHECK (prep_time BETWEEN 1 AND 1440),
  servings INTEGER NOT NULL CHECK (servings BETWEEN 1 AND 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_user_id) REFERENCES discord_users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_title_key ON recipes(title_key);
CREATE INDEX IF NOT EXISTS idx_recipes_prep_time ON recipes(prep_time);
CREATE INDEX IF NOT EXISTS idx_recipes_author ON recipes(author_user_id);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  name_key TEXT NOT NULL CHECK (length(name_key) BETWEEN 1 AND 200),
  quantity REAL NOT NULL CHECK (quantity > 0 AND quantity <= 1000000),
  unit TEXT NOT NULL CHECK (length(unit) BETWEEN 1 AND 30),
  PRIMARY KEY (recipe_id, position),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_name ON recipe_ingredients(name_key);

CREATE TABLE IF NOT EXISTS recipe_steps (
  recipe_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  PRIMARY KEY (recipe_id, position),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, recipe_id),
  FOREIGN KEY (user_id) REFERENCES discord_users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_favorites_recipe ON favorites(recipe_id);
