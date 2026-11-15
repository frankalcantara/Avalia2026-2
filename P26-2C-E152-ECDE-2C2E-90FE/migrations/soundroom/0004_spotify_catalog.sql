CREATE TABLE music_recommendation_metadata (
    recommendation_id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('spotify')),
    provider_track_id TEXT NOT NULL
        CHECK (length(provider_track_id) = 22 AND provider_track_id NOT GLOB '*[^A-Za-z0-9]*'),
    album TEXT CHECK (album IS NULL OR length(album) <= 200),
    cover_image_url TEXT
        CHECK (
            cover_image_url IS NULL
            OR (
                length(cover_image_url) <= 2048
                AND cover_image_url LIKE 'https://i.scdn.co/image/%'
            )
        ),
    external_url TEXT NOT NULL
        CHECK (
            length(external_url) <= 2048
            AND external_url = 'https://open.spotify.com/track/' || provider_track_id
        ),
    duration_ms INTEGER
        CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 86400000),
    created_at TEXT NOT NULL
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at
        ),
    FOREIGN KEY (recommendation_id)
        REFERENCES music_recommendations (id) ON DELETE RESTRICT
);

CREATE INDEX music_recommendation_metadata_provider_track_idx
    ON music_recommendation_metadata (provider, provider_track_id);

CREATE TABLE music_search_cache (
    cache_key TEXT PRIMARY KEY NOT NULL
        CHECK (length(cache_key) = 64 AND cache_key NOT GLOB '*[^0-9a-f]*'),
    response_json TEXT NOT NULL CHECK (length(response_json) <= 131072),
    created_at TEXT NOT NULL
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at
        ),
    expires_at TEXT NOT NULL
        CHECK (
            strftime('%Y-%m-%dT%H:%M:%fZ', expires_at) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', expires_at) = expires_at
            AND expires_at > created_at
        )
);

CREATE INDEX music_search_cache_expiry_idx
    ON music_search_cache (expires_at);

CREATE TABLE music_search_rate_limits (
    user_id TEXT NOT NULL,
    window_start INTEGER NOT NULL CHECK (window_start >= 0),
    request_count INTEGER NOT NULL CHECK (request_count > 0),
    PRIMARY KEY (user_id, window_start),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX music_search_rate_limits_window_idx
    ON music_search_rate_limits (window_start);
