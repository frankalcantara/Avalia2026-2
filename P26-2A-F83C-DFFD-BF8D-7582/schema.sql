CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    avatar TEXT,
    conteudo TEXT NOT NULL,
    impedimento TEXT NOT NULL,
    criado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_user_criado ON logs(user_id, criado_em DESC);
