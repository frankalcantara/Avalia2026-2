-- tests/cleanup-qa.sql
-- Remove os usuários fictícios dos testes e tudo que pertence a eles. Só no banco LOCAL:
--   npx wrangler d1 execute DB --local --file=tests/cleanup-qa.sql

DELETE FROM links WHERE user_id IN ('900000000000000001', '900000000000000002');
DELETE FROM collections WHERE user_id IN ('900000000000000001', '900000000000000002');
DELETE FROM sessions WHERE user_id IN ('900000000000000001', '900000000000000002');
DELETE FROM discord_users WHERE user_id IN ('900000000000000001', '900000000000000002');
