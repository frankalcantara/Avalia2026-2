ALTER TABLE livros
ADD COLUMN catalogo_ativo INTEGER NOT NULL DEFAULT 1
CHECK (catalogo_ativo IN (0, 1));