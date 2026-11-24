-- Usuários de teste para tests/api.test.mjs (somente banco LOCAL: wrangler d1 execute DB --local --file tests/seed.sql).
-- Idempotente. Os ids não colidem com ids reais do Discord (prefixo 9999).
INSERT OR REPLACE INTO users (user_id, username, avatar) VALUES
  ('999900000000000001', 'teste_ana',    'https://cdn.discordapp.com/embed/avatars/1.png'),
  ('999900000000000002', 'teste_bruno',  'https://cdn.discordapp.com/embed/avatars/2.png'),
  ('999900000000000003', 'teste_intruso','https://cdn.discordapp.com/embed/avatars/3.png'),
  ('999900000000000004', 'teste_o''reilly <b>x</b>', 'https://cdn.discordapp.com/embed/avatars/4.png'),
  ('999900000000000005', 'teste_carla',  'https://cdn.discordapp.com/embed/avatars/5.png');
