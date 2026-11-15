import { sha256Hex, jsonResponse } from "../auth.js";
import {
  createApiError,
  requireUser,
} from "../rooms.js";
import {
  MusicProviderError,
  searchSpotifyTracks,
} from "./providers/spotify.js";

const SEARCH_CACHE_TTL_SECONDS = 120;
const RATE_WINDOW_SECONDS = 60;
const RATE_LIMIT_PER_WINDOW = 12;
const MAX_QUERY_LENGTH = 100;
const MAX_PAGE_SIZE = 20;
const MAX_PAGE_OFFSET = 1000;

function invalidParameter() {
  throw createApiError(
    400,
    "INVALID_SEARCH",
    "Informe uma busca de até 100 caracteres e paginação válida.",
  );
}

function parseIntegerParameter(url, name, defaultValue, maximum) {
  const values = url.searchParams.getAll(name);
  if (
    values.length > 1
    || (values.length === 1 && !/^\d+$/u.test(values[0]))
  ) {
    invalidParameter();
  }
  const value = values.length ? Number(values[0]) : defaultValue;
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    invalidParameter();
  }
  return value;
}

function parseSearch(url) {
  const values = url.searchParams.getAll("q");
  if (values.length !== 1 || typeof values[0] !== "string") {
    invalidParameter();
  }
  const query = values[0].trim();
  if (
    !query
    || query.length > MAX_QUERY_LENGTH
    || /[\u0000-\u001f\u007f]/u.test(query)
  ) {
    invalidParameter();
  }
  const limit = parseIntegerParameter(url, "limit", 10, MAX_PAGE_SIZE);
  if (limit < 1) invalidParameter();
  const offset = parseIntegerParameter(url, "offset", 0, MAX_PAGE_OFFSET);
  return { query, limit, offset };
}

async function applyRateLimit(db, userId, now) {
  const timestamp = Math.floor(now / 1000);
  const windowStart = Math.floor(timestamp / RATE_WINDOW_SECONDS) * RATE_WINDOW_SECONDS;
  const row = await db.prepare(`
    INSERT INTO music_search_rate_limits (user_id, window_start, request_count)
    VALUES (?, ?, 1)
    ON CONFLICT (user_id, window_start) DO UPDATE SET
      request_count = music_search_rate_limits.request_count + 1
    RETURNING request_count
  `).bind(userId, windowStart).first();

  if (Number(row?.request_count) > RATE_LIMIT_PER_WINDOW) {
    const retryAfter = Math.max(1, windowStart + RATE_WINDOW_SECONDS - timestamp);
    throw createApiError(
      429,
      "SEARCH_RATE_LIMITED",
      "Você realizou muitas buscas. Aguarde antes de tentar novamente.",
      { "Retry-After": String(retryAfter) },
    );
  }

  if (Number(row?.request_count) === 1) {
    await db.prepare(`
      DELETE FROM music_search_rate_limits WHERE user_id = ? AND window_start < ?
    `).bind(userId, windowStart - RATE_WINDOW_SECONDS).run();
  }
}

async function cachedResponse(db, cacheKey, timestamp) {
  const row = await db.prepare(`
    SELECT response_json
    FROM music_search_cache
    WHERE cache_key = ? AND expires_at > ?
  `).bind(cacheKey, timestamp).first();
  if (!row) return null;
  try {
    return JSON.parse(row.response_json);
  } catch {
    await db.prepare("DELETE FROM music_search_cache WHERE cache_key = ?")
      .bind(cacheKey)
      .run();
    return null;
  }
}

function providerError(error) {
  if (!(error instanceof MusicProviderError)) throw error;
  return createApiError(
    error.status,
    error.code,
    error.message,
    error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {},
  );
}

export async function searchMusic({ request, env }) {
  const user = await requireUser(request, env);
  if (!env.DB) {
    throw createApiError(503, "DATABASE_UNAVAILABLE", "O banco de dados não está configurado.");
  }
  const { query, limit, offset } = parseSearch(new URL(request.url));
  const now = Date.now();
  await applyRateLimit(env.DB, user.id, now);

  const cacheKey = await sha256Hex(`${query}\n${limit}\n${offset}\nBR`);
  const timestamp = new Date(now).toISOString();
  const cached = await cachedResponse(env.DB, cacheKey, timestamp);
  if (cached) {
    return jsonResponse({ ...cached, cached: true }, 200, {
      "Cache-Control": "private, no-store",
    });
  }

  let result;
  try {
    result = await searchSpotifyTracks(env, { query, limit, offset });
  } catch (error) {
    throw providerError(error);
  }
  const response = {
    provider: "spotify",
    tracks: result.tracks,
    pagination: {
      query,
      limit,
      offset,
      total: result.total,
      hasMore: offset + limit < result.total,
      nextOffset: offset + limit < result.total ? offset + limit : null,
    },
  };

  const expiresAt = new Date(now + SEARCH_CACHE_TTL_SECONDS * 1000).toISOString();
  await env.DB.batch([
    env.DB.prepare(`
      DELETE FROM music_search_cache WHERE expires_at <= ?
    `).bind(timestamp),
    env.DB.prepare(`
      INSERT INTO music_search_cache (cache_key, response_json, created_at, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (cache_key) DO UPDATE SET
        response_json = excluded.response_json,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
    `).bind(cacheKey, JSON.stringify(response), timestamp, expiresAt),
  ]);
  return jsonResponse({ ...response, cached: false }, 200, {
    "Cache-Control": "private, no-store",
  });
}

export { parseSearch as parseMusicSearch };
