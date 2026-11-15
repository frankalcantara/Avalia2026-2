CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
    discord_id TEXT NOT NULL UNIQUE CHECK (length(discord_id) > 0),
    display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
    avatar_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at
        ),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) = updated_at
        )
);

CREATE TABLE rooms (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
    category TEXT NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 80),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at
        ),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) = updated_at
        ),
    archived_at TEXT
        CHECK (
            archived_at IS NULL
            OR (
                strftime('%Y-%m-%dT%H:%M:%fZ', archived_at) IS NOT NULL
                AND strftime('%Y-%m-%dT%H:%M:%fZ', archived_at) = archived_at
            )
        ),
    FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE recommendations (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
    room_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    genre TEXT NOT NULL CHECK (length(trim(genre)) BETWEEN 1 AND 80),
    url TEXT NOT NULL CHECK (length(url) BETWEEN 1 AND 2048),
    provider TEXT NOT NULL CHECK (provider IN ('youtube', 'spotify', 'soundcloud')),
    provider_item_id TEXT NOT NULL CHECK (length(trim(provider_item_id)) > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at
        ),
    deleted_at TEXT
        CHECK (
            deleted_at IS NULL
            OR (
                strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at) IS NOT NULL
                AND strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at) = deleted_at
            )
        ),
    CHECK (
        instr(substr(url, 9, instr(substr(url, 9), '/') - 1), '@') = 0
        AND (
            (provider = 'youtube' AND (
                url LIKE 'https://youtube.com/%'
                OR url LIKE 'https://www.youtube.com/%'
                OR url LIKE 'https://m.youtube.com/%'
                OR url LIKE 'https://youtu.be/%'
            ))
            OR (provider = 'spotify' AND url LIKE 'https://open.spotify.com/%')
            OR (provider = 'soundcloud' AND (
                url LIKE 'https://soundcloud.com/%'
                OR url LIKE 'https://on.soundcloud.com/%'
            ))
        )
    ),
    FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE RESTRICT,
    FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE votes (
    recommendation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    value INTEGER NOT NULL CHECK (value IN (-1, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at
        ),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) = updated_at
        ),
    PRIMARY KEY (recommendation_id, user_id),
    FOREIGN KEY (recommendation_id) REFERENCES recommendations (id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY NOT NULL
        CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at
        ),
    expires_at TEXT NOT NULL
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', expires_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', expires_at) = expires_at
        )
        CHECK (expires_at > created_at),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE oauth_states (
    state_hash TEXT PRIMARY KEY NOT NULL
        CHECK (length(state_hash) = 64 AND state_hash NOT GLOB '*[^0-9a-f]*'),
    expires_at TEXT NOT NULL
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', expires_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', expires_at) = expires_at
        )
);

CREATE INDEX rooms_active_created_idx
    ON rooms (archived_at, created_at DESC, id);
CREATE INDEX rooms_owner_idx
    ON rooms (owner_id, created_at DESC);
CREATE INDEX recommendations_room_visible_idx
    ON recommendations (room_id, deleted_at, created_at, id);
CREATE INDEX recommendations_author_idx
    ON recommendations (author_id, created_at DESC);
CREATE INDEX votes_recommendation_idx
    ON votes (recommendation_id, value);
CREATE INDEX votes_user_idx
    ON votes (user_id, recommendation_id);
CREATE INDEX sessions_user_expiry_idx
    ON sessions (user_id, expires_at);
CREATE INDEX sessions_expiry_idx
    ON sessions (expires_at);
CREATE INDEX oauth_states_expiry_idx
    ON oauth_states (expires_at);

CREATE TRIGGER recommendations_reject_archived_room_insert
BEFORE INSERT ON recommendations
WHEN EXISTS (
    SELECT 1
    FROM rooms
    WHERE id = NEW.room_id AND archived_at IS NOT NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Cannot add recommendations to an archived room');
END;

CREATE TRIGGER recommendations_reject_archived_room_update
BEFORE UPDATE OF room_id ON recommendations
WHEN EXISTS (
    SELECT 1
    FROM rooms
    WHERE id = NEW.room_id AND archived_at IS NOT NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Cannot move recommendations to an archived room');
END;

CREATE TRIGGER recommendations_reject_author_change
BEFORE UPDATE OF author_id ON recommendations
WHEN NEW.author_id <> OLD.author_id
BEGIN
    SELECT RAISE(ABORT, 'Recommendation author cannot be changed');
END;

CREATE TRIGGER votes_reject_ineligible_insert
BEFORE INSERT ON votes
WHEN EXISTS (
    SELECT 1
    FROM recommendations AS recommendation
    JOIN rooms AS room ON room.id = recommendation.room_id
    WHERE recommendation.id = NEW.recommendation_id
      AND (
          recommendation.author_id = NEW.user_id
          OR recommendation.deleted_at IS NOT NULL
          OR room.archived_at IS NOT NULL
      )
)
BEGIN
    SELECT RAISE(ABORT, 'Vote is not allowed for this recommendation');
END;

CREATE TRIGGER votes_reject_ineligible_update
BEFORE UPDATE OF recommendation_id, user_id, value ON votes
WHEN EXISTS (
    SELECT 1
    FROM recommendations AS recommendation
    JOIN rooms AS room ON room.id = recommendation.room_id
    WHERE recommendation.id = NEW.recommendation_id
      AND (
          recommendation.author_id = NEW.user_id
          OR recommendation.deleted_at IS NOT NULL
          OR room.archived_at IS NOT NULL
      )
)
BEGIN
    SELECT RAISE(ABORT, 'Vote is not allowed for this recommendation');
END;
