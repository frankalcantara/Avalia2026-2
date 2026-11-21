CREATE TABLE IF NOT EXISTS users (
 discord_id TEXT PRIMARY KEY NOT NULL,
 name TEXT NOT NULL,
 avatar TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS activities (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('ensino','pesquisa','extensao')),
 hours REAL NOT NULL CHECK(hours>0 AND hours<=60),
 certificate_url TEXT NOT NULL,
 activity_date TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activities_user_category ON activities(user_id,category);
