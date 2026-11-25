CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 180),
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 15000),
  accepted_answer_id INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (status = 'open' AND accepted_answer_id IS NULL) OR
    (status = 'resolved' AND accepted_answer_id IS NOT NULL)
  ),
  FOREIGN KEY (id, accepted_answer_id)
    REFERENCES answers(question_id, id)
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  author_user_id TEXT NOT NULL REFERENCES discord_users(user_id),
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 15000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (question_id, id)
);

CREATE INDEX IF NOT EXISTS idx_questions_status_created
  ON questions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_author
  ON questions(author_user_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_created
  ON answers(question_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_answers_author
  ON answers(author_user_id);
