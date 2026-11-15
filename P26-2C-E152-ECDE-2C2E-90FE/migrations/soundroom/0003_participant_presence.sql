ALTER TABLE room_participations
ADD COLUMN last_seen_at TEXT
CHECK (
    last_seen_at IS NULL
    OR (
        strftime('%Y-%m-%dT%H:%M:%fZ', last_seen_at) IS NOT NULL
        AND strftime('%Y-%m-%dT%H:%M:%fZ', last_seen_at) = last_seen_at
    )
);

UPDATE room_participations
SET last_seen_at = joined_at
WHERE left_at IS NULL;
