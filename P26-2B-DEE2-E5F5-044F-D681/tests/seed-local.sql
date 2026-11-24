-- Seed de TESTE para o D1 LOCAL (nunca rode com --remote)
-- Projeto #34 · Chave P26-2B-DEE2-E5F5-044F-D681
--
-- O Discord real não é acessível em teste automatizado, então criamos 3 usuários
-- fictícios e sessões direto no banco. O cookie "sid" usa o token em claro; o banco
-- guarda só o SHA-256 (hex) do token, exatamente como functions/_lib/auth.js faz.
--
--   usuário | token do cookie sid (64 hex)                                       | situação
--   ana     | a1a1...a1 (32x "a1")                                               | válida
--   bruno   | b2b2...b2 (32x "b2")                                               | válida
--   carla   | c3c3...c3 (32x "c3")                                               | válida
--   ana     | e4e4...e4 (32x "e4")                                               | EXPIRADA
--   ana     | d5d5...d5 (32x "d5")                                               | válida (usada só no teste de logout)
--
-- O arquivo é idempotente: pode ser executado de novo para "zerar" os dados dos
-- usuários de teste (inclusive o limite de 20 cadastros por dia).

DELETE FROM claims WHERE owner_id IN ('900000000000000001','900000000000000002','900000000000000003')
                      OR claimant_id IN ('900000000000000001','900000000000000002','900000000000000003');
DELETE FROM items WHERE owner_id IN ('900000000000000001','900000000000000002','900000000000000003');
DELETE FROM sessions WHERE user_id IN ('900000000000000001','900000000000000002','900000000000000003');

INSERT INTO discord_users (user_id, username, global_name, avatar) VALUES
  ('900000000000000001', 'ana.teste',   'Ana Teste',   NULL),
  ('900000000000000002', 'bruno.teste', 'Bruno Teste', NULL),
  ('900000000000000003', 'carla.teste', 'Carla Teste', NULL)
ON CONFLICT(user_id) DO UPDATE SET
  username = excluded.username,
  global_name = excluded.global_name,
  avatar = excluded.avatar,
  updated_at = datetime('now');

-- expires_at no formato ISO 8601 (o mesmo que new Date().toISOString() usa na comparação)
INSERT INTO sessions (token_hash, user_id, expires_at) VALUES
  ('3490f80401886d12f3861ec190f5c16419b26345497a92bc4530e22f5d8b4295', '900000000000000001', '2099-12-31T23:59:59.000Z'),
  ('92e18130ebb234a4757b877d7ba5bdc1a973140fe662a9bff9751c7ca38b5b2f', '900000000000000002', '2099-12-31T23:59:59.000Z'),
  ('1a102d593d13ce35c8897df6d1e41b7b90b23868430ac514513bc931bd791cee', '900000000000000003', '2099-12-31T23:59:59.000Z'),
  ('8f95860cab368b7dc255afc953972e0db545ac4c4a4f43cd49b8cde452741fc7', '900000000000000001', '2020-01-01T00:00:00.000Z'),
  ('c2238c8126d12fd73ee3303faf0916e02dd489d187abb74a4a1d706f7bcf8e73', '900000000000000001', '2099-12-31T23:59:59.000Z');
