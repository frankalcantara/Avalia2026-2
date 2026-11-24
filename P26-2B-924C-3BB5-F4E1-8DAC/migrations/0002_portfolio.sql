CREATE TABLE portfolio_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE INDEX portfolio_sessions_expiry ON portfolio_sessions(expires_at);
CREATE INDEX portfolio_sessions_user ON portfolio_sessions(user_id);

CREATE TABLE resumes (
  user_id TEXT PRIMARY KEY REFERENCES discord_users(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  headline TEXT NOT NULL,
  email TEXT NOT NULL,
  location TEXT NOT NULL,
  summary TEXT NOT NULL,
  theme TEXT NOT NULL CHECK (theme IN ('classic', 'modern', 'minimal')),
  colors TEXT CHECK (colors IS NULL OR json_valid(colors)),
  published INTEGER NOT NULL CHECK (published IN (0, 1))
);

CREATE TABLE resume_education (
  user_id TEXT NOT NULL REFERENCES resumes(user_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  course TEXT NOT NULL,
  institution TEXT NOT NULL,
  start_month TEXT NOT NULL,
  end_month TEXT NOT NULL,
  description TEXT NOT NULL,
  PRIMARY KEY (user_id, position)
);

CREATE TABLE resume_projects (
  user_id TEXT NOT NULL REFERENCES resumes(user_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  PRIMARY KEY (user_id, position)
);

CREATE TABLE resume_skills (
  user_id TEXT NOT NULL REFERENCES resumes(user_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (user_id, position)
);

CREATE TABLE resume_links (
  user_id TEXT NOT NULL REFERENCES resumes(user_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  PRIMARY KEY (user_id, position)
);
