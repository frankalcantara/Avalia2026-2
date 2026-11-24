CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category TEXT NOT NULL CHECK (length(trim(category)) > 0),
  description TEXT,
  date TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS transactions_user_date
  ON transactions(user_id, date);

CREATE INDEX IF NOT EXISTS transactions_user_category
  ON transactions(user_id, category);
