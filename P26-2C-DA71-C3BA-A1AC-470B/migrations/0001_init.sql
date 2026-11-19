-- Esquema Cloudflare D1 — P26-2C-DA71-C3BA-A1AC-470B
-- Projeto #35: Simulador de E-Commerce com Carteira de Créditos Fictícios
--
-- Valores monetários são INTEGER em créditos (sem casas decimais).
-- As restrições CHECK (balance >= 0, stock >= 0) são a última linha de defesa:
-- o checkout roda num env.DB.batch() (transação única) e, se qualquer UPDATE
-- deixar saldo ou estoque negativo, o CHECK falha e o lote inteiro é desfeito.

CREATE TABLE IF NOT EXISTS users (
  user_id     TEXT PRIMARY KEY,                 -- id do Discord (snowflake)
  username    TEXT NOT NULL,
  avatar      TEXT,                             -- URL completa do avatar no CDN do Discord
  balance     INTEGER NOT NULL DEFAULT 5000 CHECK (balance >= 0),
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sessões: o cookie guarda um token aleatório; aqui fica apenas o SHA-256 dele.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,                 -- epoch em segundos
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sku         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL,
  price       INTEGER NOT NULL CHECK (price > 0),
  stock       INTEGER NOT NULL CHECK (stock >= 0),
  icon        TEXT NOT NULL DEFAULT '📦',
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- Pedido = recibo histórico. Guarda saldo antes/depois para auditoria.
CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,              -- UUID gerado no servidor
  user_id        TEXT NOT NULL REFERENCES users(user_id),
  total          INTEGER NOT NULL CHECK (total > 0),
  item_count     INTEGER NOT NULL CHECK (item_count > 0),
  balance_before INTEGER NOT NULL,
  balance_after  INTEGER NOT NULL CHECK (balance_after >= 0),
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at);

-- Itens do pedido com nome e preço congelados no momento da compra.
CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  unit_price   INTEGER NOT NULL CHECK (unit_price > 0),
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  subtotal     INTEGER NOT NULL CHECK (subtotal > 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
