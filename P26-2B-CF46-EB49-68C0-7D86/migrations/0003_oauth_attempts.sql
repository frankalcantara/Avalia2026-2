ALTER TABLE users ADD COLUMN discord_username TEXT;

CREATE TABLE oauth_attempts (
  state_hash TEXT PRIMARY KEY NOT NULL CHECK (length(state_hash) = 64),
  browser_hash TEXT NOT NULL CHECK (length(browser_hash) = 64),
  code_verifier TEXT NOT NULL CHECK (length(code_verifier) = 43),
  expires_at INTEGER NOT NULL
);
CREATE INDEX oauth_attempts_expiry ON oauth_attempts(expires_at);
