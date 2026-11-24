-- Dados de exemplo para o D1 LOCAL (nunca aplique em produção).
-- Dados de exemplo (referência). Aplique pelo Console do D1, apenas em banco de desenvolvimento.
-- Sala privada: código 9c1d7a4be52f0381c6a4d7e2 (o id numérico não entra)

INSERT OR IGNORE INTO discord_users (user_id, username, avatar, updated_at)
VALUES ('100000000000000001', 'Ana Beatriz', NULL, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO rooms (id, owner_id, name, description, visibility, invite_hash, created_at)
VALUES
  (1, '100000000000000001', 'Desenvolvimento Web', 'Front-end, back-end e tudo que fica no meio.', 'public', NULL, datetime('now', '-6 days')),
  (2, '100000000000000001', 'Projeto Integrador', 'Sala privada do grupo para alinhar a entrega.', 'private', '9c1d7a4be52f0381c6a4d7e2', datetime('now', '-4 days'));

INSERT OR IGNORE INTO room_members (room_id, user_id, joined_at)
VALUES
  (1, '100000000000000001', datetime('now', '-6 days')),
  (2, '100000000000000001', datetime('now', '-4 days'));

INSERT OR IGNORE INTO articles (id, slug, author_id, room_id, title, body, created_at, updated_at)
VALUES
  (1, lower(hex(randomblob(16))), '100000000000000001', NULL, 'Markdown sem sustos: o que o editor aceita',
   '# O básico que funciona' || char(10) || char(10) ||
   'O editor aceita **negrito**, *itálico*, `código inline` e [links](https://developer.mozilla.org/). ' ||
   'HTML entra em bloco ```html e passa por sanitização antes de aparecer; SVG em bloco ```svg vira figura.' || char(10) || char(10) ||
   '## Listas ajudam a revisar' || char(10) || char(10) ||
   '- títulos com `#`, `##` e `###`' || char(10) ||
   '- listas com `-`, `*` ou `1.`' || char(10) ||
   '- blocos cercados por três crases' || char(10) || char(10) ||
   '> Citação também funciona, útil para destacar um trecho do enunciado.',
   datetime('now', '-3 days'), datetime('now', '-3 days')),
  (2, lower(hex(randomblob(16))), '100000000000000001', 1, 'Organizando o CSS do blog sem framework',
   'Dividimos os estilos em três blocos: base (tipografia, cores e reset), componentes ' ||
   '(botões, cards, campos) e layout (grade e responsividade).' || char(10) || char(10) ||
   'A regra que mais rendeu foi manter **variáveis CSS** para as cores e não repetir valores soltos pelo arquivo:' || char(10) || char(10) ||
   '```css' || char(10) || ':root {' || char(10) || '  --green: #2f725f;' || char(10) || '  --ink: #1c2927;' || char(10) || '}' || char(10) || '```' || char(10) || char(10) ||
   'Assim o tema inteiro muda em um lugar só.',
   datetime('now', '-2 days'), datetime('now', '-2 days')),
  (3, lower(hex(randomblob(16))), '100000000000000001', 2, 'Checklist da entrega do projeto integrador',
   'Sala privada: este artigo só aparece para membros.' || char(10) || char(10) ||
   '1. Rodar as migrações no D1' || char(10) ||
   '2. Conferir o callback do Discord' || char(10) ||
   '3. Testar feed, salas e comentários' || char(10) ||
   '4. Validar o projeto antes do Pull Request',
   datetime('now', '-1 days'), datetime('now', '-1 days'));

INSERT OR IGNORE INTO comments (id, article_id, author_id, body, created_at)
VALUES
  (1, 1, '100000000000000001', 'O preview salvou a revisão do texto antes de publicar.', datetime('now', '-2 days')),
  (2, 2, '100000000000000001', 'Vou tentar migrar as cores do meu projeto para variáveis também.', datetime('now', '-1 days'));

INSERT OR IGNORE INTO article_tags (article_id, tag)
VALUES
  (1, 'markdown'),
  (1, 'editor'),
  (2, 'css'),
  (2, 'front-end'),
  (3, 'entrega');

INSERT OR IGNORE INTO article_likes (article_id, user_id, created_at)
VALUES
  (1, '100000000000000001', datetime('now', '-2 days')),
  (2, '100000000000000001', datetime('now', '-1 days'));
