-- Sessões de teste para o E2E local.
-- Tokens conhecidos (64 caracteres hexadecimais):
--   dono-1  -> 'a'.repeat(64)
--   aluno-1 -> 'b'.repeat(64)
--   aluno-2 -> 'c'.repeat(64)
--
-- Uso:
--   npx.cmd wrangler d1 execute DB --local --file=scripts/semear-sessoes.sql
--
-- O hash gravado é sempre sha256(token); o token em si nunca entra no banco.

INSERT OR REPLACE INTO discord_users (user_id, username, global_name, avatar, created_at, updated_at) VALUES
  ('dono-1',  'dono',  'Dono da Sala', 'https://cdn.discordapp.com/embed/avatars/0.png', '2026-11-08T10:00:00.000Z', '2026-11-08T10:00:00.000Z'),
  ('aluno-1', 'aluno', 'Aluno Teste',  NULL,                                            '2026-11-08T10:00:00.000Z', '2026-11-08T10:00:00.000Z'),
  ('aluno-2', 'aluna', 'Aluna Teste',  NULL,                                            '2026-11-08T10:00:00.000Z', '2026-11-08T10:00:00.000Z');

INSERT OR REPLACE INTO sessions (token_hash, user_id, created_at, expires_at) VALUES
  ('ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb', 'dono-1',  '2026-11-08T10:00:00.000Z', '2027-11-08T10:00:00.000Z'),
  ('a0fab1377f49a759b57f63318262ebe89fabfc990e8e93ceac2984561482b9d4', 'aluno-1', '2026-11-08T10:00:00.000Z', '2027-11-08T10:00:00.000Z'),
  ('52b6419d27bd7f547cee3b92f8c17a908b8a49601ecbec161e5030de1dfe9e0a', 'aluno-2', '2026-11-08T10:00:00.000Z', '2027-11-08T10:00:00.000Z');
