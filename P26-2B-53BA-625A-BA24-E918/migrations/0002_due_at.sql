-- Prazo opcional (data de entrega) para lembretes. Coluna aditiva: avisos antigos ficam com due_at NULL.
ALTER TABLE posts ADD COLUMN due_at TEXT;
CREATE INDEX IF NOT EXISTS idx_posts_due ON posts(due_at);