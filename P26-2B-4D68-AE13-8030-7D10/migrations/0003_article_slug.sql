-- URL opaca por artigo: 32 caracteres hexadecimais (128 bits) gerados aleatoriamente.
-- O slug é identificador de URL, não credencial: o acesso à sala continua sendo decidido por room_members.
ALTER TABLE articles ADD COLUMN slug TEXT;

UPDATE articles SET slug = lower(hex(randomblob(16))) WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
