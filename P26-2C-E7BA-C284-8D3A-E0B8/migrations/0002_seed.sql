-- Migration 0002: livro da rodada atual
-- EDITE o título e o número de capítulos para o livro que o grupo vai ler.

-- Garante no próprio banco que só pode existir UM livro ativo por vez
-- (as Functions usam "WHERE active = 1 LIMIT 1").
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_single_active
ON books(active) WHERE active = 1;

INSERT OR IGNORE INTO books (title, total_chapters, active)
VALUES ('Duna - Frank Herbert', 12, 1);