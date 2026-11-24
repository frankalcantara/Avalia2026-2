-- Remover um membro bloqueia a entrada: a pessoa não volta pela fila de aprovação
-- nem pelo link livre. O dono libera de novo com DELETE /api/rooms/:id/blocks?userId=…
CREATE TABLE IF NOT EXISTS room_blocks (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id)
);
