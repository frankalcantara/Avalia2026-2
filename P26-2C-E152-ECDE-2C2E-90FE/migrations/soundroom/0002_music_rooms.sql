ALTER TABLE rooms
ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1
CHECK (is_public IN (0, 1));

CREATE TABLE room_participations (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 64),
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at TEXT NOT NULL
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', joined_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', joined_at) = joined_at
        ),
    left_at TEXT
        CHECK (
            left_at IS NULL
            OR (
                strftime('%Y-%m-%dT%H:%M:%fZ', left_at) IS NOT NULL
                AND strftime('%Y-%m-%dT%H:%M:%fZ', left_at) = left_at
                AND left_at >= joined_at
            )
        ),
    FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX room_participations_active_unique_idx
    ON room_participations (room_id, user_id)
    WHERE left_at IS NULL;
CREATE INDEX room_participations_room_history_idx
    ON room_participations (room_id, joined_at DESC, id);
CREATE INDEX room_participations_user_history_idx
    ON room_participations (user_id, joined_at DESC, room_id);

CREATE TABLE music_recommendations (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 64),
    room_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    artist TEXT NOT NULL CHECK (length(trim(artist)) BETWEEN 1 AND 160),
    genre TEXT NOT NULL CHECK (
        genre IN (
            'Pop', 'Rock', 'Hip-Hop', 'Rap', 'Funk', 'Eletrônica',
            'Jazz', 'Clássica', 'Sertanejo', 'MPB', 'Reggae', 'Outros'
        )
    ),
    created_at TEXT NOT NULL
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at
        ),
    updated_at TEXT NOT NULL
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) = updated_at
        ),
    deleted_at TEXT
        CHECK (
            deleted_at IS NULL
            OR (
                strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at) IS NOT NULL
                AND strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at) = deleted_at
            )
        ),
    FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE RESTRICT,
    FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX music_recommendations_room_visible_idx
    ON music_recommendations (room_id, deleted_at, created_at, id);
CREATE INDEX music_recommendations_author_idx
    ON music_recommendations (author_id, created_at DESC);

CREATE TABLE music_votes (
    recommendation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    value INTEGER NOT NULL CHECK (value IN (-1, 1)),
    created_at TEXT NOT NULL
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at
        ),
    updated_at TEXT NOT NULL
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) = updated_at
        ),
    PRIMARY KEY (recommendation_id, user_id),
    FOREIGN KEY (recommendation_id) REFERENCES music_recommendations (id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX music_votes_recommendation_idx
    ON music_votes (recommendation_id, value);
CREATE INDEX music_votes_user_idx
    ON music_votes (user_id, recommendation_id);

CREATE TRIGGER room_participations_validate_insert
BEFORE INSERT ON room_participations
WHEN NOT EXISTS (
    SELECT 1
    FROM rooms
    WHERE id = NEW.room_id
      AND is_public = 1
      AND archived_at IS NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Room is not open for participation');
END;

CREATE TRIGGER room_participations_immutable_identity
BEFORE UPDATE OF room_id, user_id, joined_at ON room_participations
WHEN NEW.room_id <> OLD.room_id
  OR NEW.user_id <> OLD.user_id
  OR NEW.joined_at <> OLD.joined_at
BEGIN
    SELECT RAISE(ABORT, 'Participation history is immutable');
END;

CREATE TRIGGER room_participations_immutable_exit
BEFORE UPDATE OF left_at ON room_participations
WHEN OLD.left_at IS NOT NULL AND NEW.left_at IS NOT OLD.left_at
BEGIN
    SELECT RAISE(ABORT, 'Participation exit cannot be changed');
END;

CREATE TRIGGER room_participations_preserve_history
BEFORE DELETE ON room_participations
BEGIN
    SELECT RAISE(ABORT, 'Participation history cannot be deleted');
END;

CREATE TRIGGER rooms_close_participations
AFTER UPDATE OF archived_at ON rooms
WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL
BEGIN
    UPDATE room_participations
    SET left_at = NEW.archived_at
    WHERE room_id = NEW.id AND left_at IS NULL;
END;

CREATE TRIGGER music_recommendations_validate_insert
BEFORE INSERT ON music_recommendations
WHEN NOT EXISTS (
    SELECT 1
    FROM rooms AS room
    JOIN room_participations AS participation
      ON participation.room_id = room.id
     AND participation.user_id = NEW.author_id
     AND participation.left_at IS NULL
    WHERE room.id = NEW.room_id
      AND room.is_public = 1
      AND room.archived_at IS NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Active participation is required to recommend music');
END;

CREATE TRIGGER music_recommendations_immutable_identity
BEFORE UPDATE OF room_id, author_id ON music_recommendations
WHEN NEW.room_id <> OLD.room_id OR NEW.author_id <> OLD.author_id
BEGIN
    SELECT RAISE(ABORT, 'Recommendation identity is immutable');
END;

CREATE TRIGGER music_recommendations_preserve_history
BEFORE DELETE ON music_recommendations
BEGIN
    SELECT RAISE(ABORT, 'Recommendation history cannot be deleted');
END;

CREATE TRIGGER music_recommendations_no_restore
BEFORE UPDATE OF deleted_at ON music_recommendations
WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL
BEGIN
    SELECT RAISE(ABORT, 'Deleted recommendations cannot be restored');
END;

CREATE TRIGGER music_votes_validate_insert
BEFORE INSERT ON music_votes
WHEN NOT EXISTS (
    SELECT 1
    FROM music_recommendations AS recommendation
    JOIN rooms AS room ON room.id = recommendation.room_id
    JOIN room_participations AS participation
      ON participation.room_id = room.id
     AND participation.user_id = NEW.user_id
     AND participation.left_at IS NULL
    WHERE recommendation.id = NEW.recommendation_id
      AND recommendation.author_id <> NEW.user_id
      AND recommendation.deleted_at IS NULL
      AND room.is_public = 1
      AND room.archived_at IS NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Active participation is required to vote');
END;

CREATE TRIGGER music_votes_validate_update
BEFORE UPDATE OF recommendation_id, user_id, value ON music_votes
WHEN NOT EXISTS (
    SELECT 1
    FROM music_recommendations AS recommendation
    JOIN rooms AS room ON room.id = recommendation.room_id
    JOIN room_participations AS participation
      ON participation.room_id = room.id
     AND participation.user_id = NEW.user_id
     AND participation.left_at IS NULL
    WHERE recommendation.id = NEW.recommendation_id
      AND recommendation.author_id <> NEW.user_id
      AND recommendation.deleted_at IS NULL
      AND room.is_public = 1
      AND room.archived_at IS NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Active participation is required to vote');
END;
