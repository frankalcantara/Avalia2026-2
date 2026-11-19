-- tests/seed-qa.sql
-- Cria usuários e sessões FICTÍCIOS só para os testes automáticos (Projeto #42, chave P26-2A-567B-6EC5-D24D-9098).
-- Rode ANTES de cada execução (restaura também a sessão descartável usada no teste de logout):
--   npx wrangler d1 execute DB --local --file=tests/seed-qa.sql
-- Nunca rode no banco remoto (produção).
--
-- Sessões (valor do cookie discord_session = id, 64 caracteres hexadecimais):
--   a... (64 "a") -> usuário A   (QA_SESSION_A)
--   b... (64 "b") -> usuário B   (QA_SESSION_B)
--   c... (64 "c") -> usuário A   (QA_SESSION_LOGOUT, consumida pelo teste de logout)
--   d... (64 "d") -> usuário A   (QA_SESSION_EXPIRED, já expirada)

INSERT INTO discord_users (user_id, username, avatar)
VALUES ('900000000000000001', 'qa_user_a', NULL)
ON CONFLICT(user_id) DO UPDATE SET username = excluded.username;

INSERT INTO discord_users (user_id, username, avatar)
VALUES ('900000000000000002', 'qa_user_b', NULL)
ON CONFLICT(user_id) DO UPDATE SET username = excluded.username;

INSERT OR REPLACE INTO sessions (id, user_id, expires_at)
VALUES ('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '900000000000000001', '2099-12-31 23:59:59');

INSERT OR REPLACE INTO sessions (id, user_id, expires_at)
VALUES ('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '900000000000000002', '2099-12-31 23:59:59');

INSERT OR REPLACE INTO sessions (id, user_id, expires_at)
VALUES ('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', '900000000000000001', '2099-12-31 23:59:59');

INSERT OR REPLACE INTO sessions (id, user_id, expires_at)
VALUES ('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', '900000000000000001', '2000-01-01 00:00:00');
