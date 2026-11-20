/**
 * Camada de inicialização idempotente e helpers de acesso ao Cloudflare D1.
 */
import { errorResponse } from "./http.js";

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS discord_users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    theme_tag TEXT NOT NULL DEFAULT 'Foco & Código',
    created_by TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    genre TEXT NOT NULL,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('youtube', 'spotify', 'soundcloud')),
    embed_url TEXT NOT NULL,
    submitted_by TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, normalized_url)
  )`,
  `CREATE TABLE IF NOT EXISTS track_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
    value INTEGER NOT NULL CHECK (value IN (-1, 1)),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(track_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_tracks_room_id ON tracks(room_id)`,
  `CREATE INDEX IF NOT EXISTS idx_track_votes_track_id ON track_votes(track_id)`,
  `CREATE INDEX IF NOT EXISTS idx_track_votes_user_id ON track_votes(user_id)`,
];

export async function runBatchStatements(db, statements) {
  if (typeof db.batch === "function") {
    await db.batch(statements);
    return;
  }

  for (const stmt of statements) {
    await stmt.run();
  }
}

export async function ensureSchema(db) {
  if (!db) {
    throw new Error("Instância D1 não fornecida.");
  }

  const prepared = SCHEMA_STATEMENTS.map((sql) => db.prepare(sql));
  await runBatchStatements(db, prepared);
}

export async function requireDb(env) {
  if (!env || !env.DB) {
    return {
      db: null,
      response: errorResponse(
        "Banco de dados Cloudflare D1 não configurado neste ambiente.",
        "DB_UNAVAILABLE",
        503
      ),
    };
  }

  try {
    await ensureSchema(env.DB);
    return { db: env.DB, response: null };
  } catch {
    return {
      db: null,
      response: errorResponse(
        "Falha ao inicializar o banco de dados Cloudflare D1.",
        "DB_INIT_FAILED",
        500
      ),
    };
  }
}

export async function findRoomByIdOrSlug(db, identifier) {
  const raw = String(identifier ?? "").trim();
  if (!raw) return null;

  const baseSelect = `
    SELECT
      r.id,
      r.slug,
      r.name,
      r.description,
      r.theme_tag,
      r.created_by,
      r.created_at,
      u.username AS creator_username,
      u.avatar AS creator_avatar
    FROM rooms r
    LEFT JOIN discord_users u ON u.user_id = r.created_by
  `;

  if (/^\d+$/.test(raw)) {
    const numericId = Number(raw);
    const byId = await db
      .prepare(`${baseSelect} WHERE r.id = ? LIMIT 1`)
      .bind(numericId)
      .first();
    if (byId) return byId;
  }

  return await db
    .prepare(`${baseSelect} WHERE r.slug = ? LIMIT 1`)
    .bind(raw)
    .first();
}
