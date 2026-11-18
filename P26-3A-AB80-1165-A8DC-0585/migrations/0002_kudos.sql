
-- DevGratitude - Projeto #29
-- Chave: P26-3A-AB80-1165-A8DC-0585
-- Migracao 0002: Mural de Reconhecimento

CREATE TABLE IF NOT EXISTS kudos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,

    badge TEXT NOT NULL
        CHECK (
            badge IN ('bug', 'explanation', 'teamwork')
        ),

    message TEXT NOT NULL
        CHECK (
            length(message) BETWEEN 5 AND 280
        ),

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (sender_id)
        REFERENCES discord_users(user_id),

    FOREIGN KEY (recipient_id)
        REFERENCES discord_users(user_id),

    CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_kudos_sender
ON kudos(sender_id);

CREATE INDEX IF NOT EXISTS idx_kudos_recipient
ON kudos(recipient_id);

CREATE INDEX IF NOT EXISTS idx_kudos_created
ON kudos(created_at);
