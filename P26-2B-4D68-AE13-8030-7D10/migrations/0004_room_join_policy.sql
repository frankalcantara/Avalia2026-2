-- Política de entrada da sala privada:
--   open_link → quem tem o código de convite entra direto (comportamento antigo)
--   approval  → o pedido fica pendente até o dono aprovar (whitelist)
ALTER TABLE rooms ADD COLUMN join_policy TEXT NOT NULL DEFAULT 'open_link'
  CHECK (join_policy IN ('open_link', 'approval'));

CREATE TABLE IF NOT EXISTS room_join_requests (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id)
);
