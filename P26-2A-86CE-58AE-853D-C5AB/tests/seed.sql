INSERT OR IGNORE INTO discord_users (user_id, username, avatar)
VALUES
  ('111', 'Usuario Teste A', 'https://cdn.discordapp.com/embed/avatars/0.png'),
  ('222', 'Usuario Teste B', 'https://cdn.discordapp.com/embed/avatars/1.png');

DELETE FROM sessoes WHERE token = 'teste-logout';

INSERT OR IGNORE INTO sessoes (token, user_id, expira_em)
VALUES
  ('teste-a', '111', '2099-12-31T23:59:59.000Z'),
  ('teste-b', '222', '2099-12-31T23:59:59.000Z'),
  ('teste-logout', '111', '2099-12-31T23:59:59.000Z');
