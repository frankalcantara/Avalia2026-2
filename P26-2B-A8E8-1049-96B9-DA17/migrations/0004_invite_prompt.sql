-- Convite ao servidor do Discord: NULL = ainda não respondeu (pergunta uma vez por usuário).
ALTER TABLE discord_users ADD COLUMN invite_prompt_seen_at TEXT;
-- Backfill: quem já existe não é perguntado; só os novos (criados com NULL pelo callback).
UPDATE discord_users SET invite_prompt_seen_at = CURRENT_TIMESTAMP WHERE invite_prompt_seen_at IS NULL;
