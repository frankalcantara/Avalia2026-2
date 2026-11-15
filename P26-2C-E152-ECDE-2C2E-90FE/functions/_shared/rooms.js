import {
  getAppUrl,
  jsonResponse,
  methodNotAllowed,
  readCookie,
  sha256Hex,
} from "./auth.js";

const SESSION_COOKIE = "soundroom_session";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_PAGE_OFFSET = 10000;
const MAX_JSON_BYTES = 16384;
const GENRES = new Set([
  "Pop",
  "Rock",
  "Hip-Hop",
  "Rap",
  "Funk",
  "Eletrônica",
  "Jazz",
  "Clássica",
  "Sertanejo",
  "MPB",
  "Reggae",
  "Outros",
]);

class ApiError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function createApiError(status, code, message, headers = {}) {
  return new ApiError(status, code, message, headers);
}

function fail(status, code, message, headers = {}) {
  throw createApiError(status, code, message, headers);
}

function errorResponse(error) {
  if (error instanceof ApiError) {
    return jsonResponse({
      error: { code: error.code, message: error.message },
    }, error.status, error.headers);
  }

  console.error("Room API request failed:", error?.name ?? "UnknownError");
  return jsonResponse({
    error: {
      code: "INTERNAL_ERROR",
      message: "Não foi possível concluir a solicitação.",
    },
  }, 500);
}

export function createRouteHandler(handlers) {
  const allowedMethods = Object.keys(handlers).join(", ");
  return async (context) => {
    const handler = handlers[context.request.method];
    if (!handler) {
      return methodNotAllowed(allowedMethods);
    }

    try {
      return await handler(context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

function assertDatabase(env) {
  if (!env.DB) {
    fail(503, "DATABASE_UNAVAILABLE", "O banco de dados não está configurado.");
  }
}

export function assertSameOrigin(request, env) {
  let appUrl;
  try {
    appUrl = getAppUrl(env);
  } catch {
    fail(503, "APP_NOT_CONFIGURED", "A origem da aplicação não está configurada.");
  }

  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (
    request.headers.get("Origin") !== appUrl.origin
    || (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")
  ) {
    fail(403, "CSRF_REJECTED", "Origem da solicitação não permitida.");
  }
}

async function findUser(request, env) {
  assertDatabase(env);
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || token.length > 128) {
    return null;
  }

  const tokenHash = await sha256Hex(token);
  return env.DB.prepare(`
    SELECT users.id, users.display_name, users.avatar_hash, users.discord_id
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).bind(tokenHash, new Date().toISOString()).first();
}

export async function requireUser(request, env) {
  const user = await findUser(request, env);
  if (!user) {
    fail(401, "AUTHENTICATION_REQUIRED", "Entre com o Discord para continuar.");
  }
  return user;
}

export function parsePage(url) {
  const values = {};
  for (const key of ["limit", "offset"]) {
    const all = url.searchParams.getAll(key);
    if (all.length > 1 || (all.length === 1 && !/^\d+$/u.test(all[0]))) {
      fail(400, "INVALID_PAGINATION", "Os parâmetros de paginação são inválidos.");
    }
    values[key] = all.length === 1 ? Number(all[0]) : null;
  }

  const limit = values.limit ?? DEFAULT_PAGE_SIZE;
  const offset = values.offset ?? 0;
  if (
    !Number.isSafeInteger(limit)
    || limit < 1
    || limit > MAX_PAGE_SIZE
    || !Number.isSafeInteger(offset)
    || offset < 0
    || offset > MAX_PAGE_OFFSET
  ) {
    fail(400, "INVALID_PAGINATION", "Use limit entre 1 e 50 e offset entre 0 e 10000.");
  }
  return { limit, offset };
}

export function readIdentifier(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/u.test(value)) {
    fail(400, "INVALID_ID", "O identificador informado é inválido.");
  }
  return value;
}

function pathIdentifier(context, name) {
  return readIdentifier(context.params?.[name]);
}

function parseJsonObject(request) {
  return readJsonObject(request);
}

async function readJsonObject(request) {
  const contentLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    fail(413, "BODY_TOO_LARGE", "O conteúdo enviado excede o limite permitido.");
  }

  const reader = request.body?.getReader();
  const chunks = [];
  let totalBytes = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_JSON_BYTES) {
        await reader.cancel();
        fail(413, "BODY_TOO_LARGE", "O conteúdo enviado excede o limite permitido.");
      }
      chunks.push(value);
    }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(400, "INVALID_JSON", "O corpo da solicitação deve conter JSON válido.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(400, "INVALID_JSON", "O corpo da solicitação deve ser um objeto JSON.");
  }
  return value;
}

function assertJsonContentType(request) {
  if (!/^application\/json(?:\s*;|$)/iu.test(request.headers.get("Content-Type") ?? "")) {
    fail(415, "JSON_REQUIRED", "Envie o conteúdo como application/json.");
  }
}

function allowOnlyKeys(value, allowed) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    fail(400, "UNKNOWN_FIELDS", "A solicitação contém campos não reconhecidos.");
  }
}

export function textField(value, name, maximum, required = true) {
  if (value === undefined && !required) {
    return "";
  }
  if (typeof value !== "string") {
    fail(400, "INVALID_FIELD", `O campo ${name} deve ser texto.`);
  }
  const result = value.trim();
  if ((required && result.length === 0) || result.length > maximum) {
    fail(400, "INVALID_FIELD", `O campo ${name} deve ter entre ${required ? 1 : 0} e ${maximum} caracteres.`);
  }
  return result;
}

export function isSupportedGenre(genre) {
  return GENRES.has(genre);
}

function avatarUrl(user) {
  if (!user.avatar_hash) {
    return null;
  }
  const extension = user.avatar_hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.discord_id)}/${encodeURIComponent(user.avatar_hash)}.${extension}`;
}

function publicPerson(user) {
  return {
    id: user.user_id ?? user.id,
    displayName: user.display_name,
    avatarUrl: avatarUrl(user),
  };
}

function shapeRoom(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    visibility: "public",
    status: row.archived_at === null ? "active" : "ended",
    createdAt: row.created_at,
    endedAt: row.archived_at,
    owner: {
      id: row.owner_id,
      displayName: row.owner_name,
      avatarUrl: row.owner_avatar_hash
        ? avatarUrl({
          discord_id: row.owner_discord_id,
          avatar_hash: row.owner_avatar_hash,
        })
        : null,
    },
    participantCount: Number(row.participant_count),
    recommendationCount: Number(row.recommendation_count),
    isParticipant: Boolean(row.is_participant),
  };
}

const ROOM_SELECT = `
  SELECT room.id, room.owner_id, room.name, room.description, room.category,
         room.created_at, room.archived_at,
         owner.display_name AS owner_name,
         owner.avatar_hash AS owner_avatar_hash,
         owner.discord_id AS owner_discord_id,
         (SELECT COUNT(*) FROM room_participations AS participation
          WHERE participation.room_id = room.id AND participation.left_at IS NULL)
           AS participant_count,
         (SELECT COUNT(*) FROM music_recommendations AS recommendation
          WHERE recommendation.room_id = room.id AND recommendation.deleted_at IS NULL)
           AS recommendation_count,
         CASE WHEN ? IS NOT NULL AND EXISTS (
           SELECT 1 FROM room_participations AS membership
           WHERE membership.room_id = room.id
             AND membership.user_id = ?
             AND membership.left_at IS NULL
         ) THEN 1 ELSE 0 END AS is_participant
  FROM rooms AS room
  JOIN users AS owner ON owner.id = room.owner_id
`;

async function queryRoom(db, roomId, userId = null) {
  return db.prepare(`${ROOM_SELECT}
    WHERE room.id = ? AND room.is_public = 1
  `).bind(userId, userId, roomId).first();
}

function roomNotFound() {
  fail(404, "ROOM_NOT_FOUND", "A sala não foi encontrada.");
}

async function requirePublicRoom(db, roomId) {
  const row = await db.prepare(`
    SELECT id, archived_at
    FROM rooms
    WHERE id = ? AND is_public = 1
  `).bind(roomId).first();
  if (!row) {
    roomNotFound();
  }
  return row;
}

async function requireOpenRoom(db, roomId) {
  const room = await requirePublicRoom(db, roomId);
  if (room.archived_at !== null) {
    fail(409, "ROOM_ENDED", "A sala está encerrada.");
  }
}

async function requireMembership(db, roomId, userId) {
  const membership = await db.prepare(`
    SELECT 1 AS is_member
    FROM room_participations
    WHERE room_id = ? AND user_id = ? AND left_at IS NULL
  `).bind(roomId, userId).first();
  if (!membership) {
    fail(403, "PARTICIPATION_REQUIRED", "Entre na sala para realizar esta ação.");
  }
}

function newId() {
  return crypto.randomUUID();
}

export async function listRooms({ request, env }) {
  assertDatabase(env);
  const { limit, offset } = parsePage(new URL(request.url));
  const user = await findUser(request, env);
  const rows = await env.DB.prepare(`${ROOM_SELECT}
    WHERE room.archived_at IS NULL AND room.is_public = 1
    ORDER BY room.created_at DESC, room.id ASC
    LIMIT ? OFFSET ?
  `).bind(user?.id ?? null, user?.id ?? null, limit + 1, offset).all();
  const hasMore = rows.results.length > limit;
  const rooms = rows.results.slice(0, limit).map(shapeRoom);
  return jsonResponse({
    rooms,
    pagination: { limit, offset, hasMore, nextOffset: hasMore ? offset + limit : null },
  });
}

export async function createRoom({ request, env }) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  assertJsonContentType(request);
  const body = await parseJsonObject(request);
  allowOnlyKeys(body, ["name", "description", "category", "visibility"]);
  const name = textField(body.name, "name", 120);
  const description = textField(body.description, "description", 2000, false);
  const category = body.category === undefined
    ? "Estudo e programação"
    : textField(body.category, "category", 80);
  if (body.visibility !== undefined && body.visibility !== "public") {
    fail(400, "INVALID_VISIBILITY", "Nesta etapa, as salas devem ser públicas.");
  }

  const id = newId();
  const timestamp = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO rooms (id, owner_id, name, description, category, created_at, updated_at, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(id, user.id, name, description, category, timestamp, timestamp),
    env.DB.prepare(`
      INSERT INTO room_participations (id, room_id, user_id, joined_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(newId(), id, user.id, timestamp, timestamp),
  ]);
  const room = await queryRoom(env.DB, id, user.id);
  return jsonResponse({ room: shapeRoom(room) }, 201);
}

export async function getRoom({ request, env, params }) {
  assertDatabase(env);
  const roomId = pathIdentifier({ params }, "roomId");
  const user = await findUser(request, env);
  const room = await queryRoom(env.DB, roomId, user?.id ?? null);
  if (!room) {
    roomNotFound();
  }
  return jsonResponse({ room: shapeRoom(room) });
}

export async function joinRoom({ request, env, params }) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  const roomId = pathIdentifier({ params }, "roomId");
  const timestamp = new Date().toISOString();
  const inserted = await env.DB.prepare(`
    INSERT INTO room_participations (id, room_id, user_id, joined_at, last_seen_at)
    SELECT ?, room.id, ?, ?, ?
    FROM rooms AS room
    WHERE room.id = ? AND room.is_public = 1 AND room.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM room_participations AS current
        WHERE current.room_id = room.id AND current.user_id = ? AND current.left_at IS NULL
      )
    RETURNING id
  `).bind(newId(), user.id, timestamp, timestamp, roomId, user.id).first();

  if (!inserted) {
    const room = await env.DB.prepare(`
      SELECT archived_at FROM rooms WHERE id = ? AND is_public = 1
    `).bind(roomId).first();
    if (!room) roomNotFound();
    if (room.archived_at !== null) {
      fail(409, "ROOM_ENDED", "Não é possível entrar em uma sala encerrada.");
    }
    fail(409, "ALREADY_JOINED", "Você já participa desta sala.");
  }
  return jsonResponse({ joined: true, joinedAt: timestamp }, 201);
}

export async function leaveRoom({ request, env, params }) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  const roomId = pathIdentifier({ params }, "roomId");
  const timestamp = new Date().toISOString();
  const result = await env.DB.prepare(`
    UPDATE room_participations
    SET left_at = ?
    WHERE room_id = ? AND user_id = ? AND left_at IS NULL
      AND EXISTS (
        SELECT 1 FROM rooms
        WHERE rooms.id = room_participations.room_id
          AND rooms.is_public = 1 AND rooms.archived_at IS NULL
      )
  `).bind(timestamp, roomId, user.id).run();
  if (!result.meta.changes) {
    const room = await env.DB.prepare(`
      SELECT archived_at FROM rooms WHERE id = ? AND is_public = 1
    `).bind(roomId).first();
    if (!room) roomNotFound();
    if (room.archived_at !== null) {
      fail(409, "ROOM_ENDED", "A sala está encerrada.");
    }
    fail(409, "NOT_JOINED", "Você não participa desta sala.");
  }
  return jsonResponse({ left: true, leftAt: timestamp });
}

export async function updatePresence({ request, env, params }) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  const roomId = pathIdentifier({ params }, "roomId");
  const timestamp = new Date().toISOString();
  const updated = await env.DB.prepare(`
    UPDATE room_participations
    SET last_seen_at = ?
    WHERE room_id = ? AND user_id = ? AND left_at IS NULL
      AND EXISTS (
        SELECT 1 FROM rooms
        WHERE rooms.id = room_participations.room_id
          AND rooms.is_public = 1 AND rooms.archived_at IS NULL
      )
    RETURNING id
  `).bind(timestamp, roomId, user.id).first();
  if (!updated) {
    const room = await env.DB.prepare(`
      SELECT archived_at FROM rooms WHERE id = ? AND is_public = 1
    `).bind(roomId).first();
    if (!room) roomNotFound();
    if (room.archived_at !== null) {
      fail(409, "ROOM_ENDED", "A sala está encerrada.");
    }
    fail(403, "PARTICIPATION_REQUIRED", "Entre na sala para atualizar sua presença.");
  }
  return jsonResponse({ lastSeenAt: timestamp });
}

export async function closeRoom({ request, env, params }) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  const roomId = pathIdentifier({ params }, "roomId");
  const timestamp = new Date().toISOString();
  const result = await env.DB.prepare(`
    UPDATE rooms
    SET archived_at = ?, updated_at = ?
    WHERE id = ? AND owner_id = ? AND is_public = 1 AND archived_at IS NULL
  `).bind(timestamp, timestamp, roomId, user.id).run();
  if (!result.meta.changes) {
    const room = await env.DB.prepare(`
      SELECT owner_id, archived_at FROM rooms WHERE id = ? AND is_public = 1
    `).bind(roomId).first();
    if (!room) roomNotFound();
    if (room.owner_id !== user.id) {
      fail(403, "ROOM_OWNER_REQUIRED", "Somente a pessoa criadora pode encerrar a sala.");
    }
    fail(409, "ROOM_ENDED", "A sala já está encerrada.");
  }
  return jsonResponse({ closed: true, endedAt: timestamp });
}

export async function listParticipants({ request, env, params }) {
  assertDatabase(env);
  const roomId = pathIdentifier({ params }, "roomId");
  await requirePublicRoom(env.DB, roomId);
  const { limit, offset } = parsePage(new URL(request.url));
  const presenceCutoff = new Date(Date.now() - 90_000).toISOString();
  const result = await env.DB.prepare(`
    SELECT participation.id, participation.joined_at, participation.last_seen_at,
           user.id AS user_id, user.display_name, user.avatar_hash, user.discord_id,
           CASE WHEN participation.last_seen_at >= ? THEN 'online' ELSE 'offline' END AS presence
    FROM room_participations AS participation
    JOIN users AS user ON user.id = participation.user_id
    JOIN rooms AS room ON room.id = participation.room_id
    WHERE participation.room_id = ?
      AND participation.left_at IS NULL
      AND room.archived_at IS NULL
    ORDER BY participation.joined_at ASC, participation.id ASC
    LIMIT ? OFFSET ?
  `).bind(presenceCutoff, roomId, limit + 1, offset).all();
  const hasMore = result.results.length > limit;
  return jsonResponse({
    participants: result.results.slice(0, limit).map((row) => ({
      participationId: row.id,
      user: publicPerson(row),
      joinedAt: row.joined_at,
      presence: row.presence,
    })),
    pagination: { limit, offset, hasMore, nextOffset: hasMore ? offset + limit : null },
  });
}

function shapeRecommendation(row) {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    genre: row.genre,
    provider: row.provider ?? null,
    providerTrackId: row.provider_track_id ?? null,
    album: row.album ?? null,
    coverImageUrl: row.cover_image_url ?? null,
    externalUrl: row.recommendation_external_url ?? row.external_url ?? null,
    durationMs: row.duration_ms === null || row.duration_ms === undefined
      ? null
      : Number(row.duration_ms),
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    status: row.deleted_at === null ? "active" : "removed",
    author: {
      id: row.author_id,
      displayName: row.author_name,
      avatarUrl: row.author_avatar_hash
        ? avatarUrl({
          discord_id: row.author_discord_id,
          avatar_hash: row.author_avatar_hash,
        })
        : null,
    },
    score: Number(row.score),
    userVote: row.user_vote === null ? null : Number(row.user_vote),
  };
}

const RECOMMENDATION_SELECT = `
  SELECT recommendation.id, recommendation.title, recommendation.artist,
         recommendation.genre, recommendation.created_at, recommendation.deleted_at,
         recommendation.author_id,
         author.display_name AS author_name,
         author.avatar_hash AS author_avatar_hash,
         author.discord_id AS author_discord_id,
         COALESCE(recommendation.provider, metadata.provider) AS provider,
         metadata.provider_track_id, metadata.album,
         metadata.cover_image_url,
         COALESCE(recommendation.external_url, metadata.external_url) AS recommendation_external_url,
         metadata.external_url, metadata.duration_ms,
         COALESCE(SUM(vote.value), 0) AS score,
         MAX(CASE WHEN vote.user_id = ? THEN vote.value END) AS user_vote
  FROM music_recommendations AS recommendation
  JOIN users AS author ON author.id = recommendation.author_id
  LEFT JOIN music_recommendation_metadata AS metadata
    ON metadata.recommendation_id = recommendation.id
  LEFT JOIN music_votes AS vote ON vote.recommendation_id = recommendation.id
`;

function prepareRecommendationRows(db, roomId, userId, limit, offset, history) {
  const conditions = history
    ? "recommendation.room_id = ?"
    : `recommendation.room_id = ?
       AND recommendation.deleted_at IS NULL
       AND EXISTS (
         SELECT 1 FROM rooms
         WHERE rooms.id = recommendation.room_id AND rooms.archived_at IS NULL
       )`;
  const order = history
    ? "recommendation.created_at DESC, recommendation.id ASC"
    : "score DESC, recommendation.created_at ASC, recommendation.id ASC";
  return db.prepare(`${RECOMMENDATION_SELECT}
    WHERE ${conditions}
    GROUP BY recommendation.id
    ORDER BY ${order}
    LIMIT ? OFFSET ?
  `).bind(userId, roomId, limit + 1, offset);
}

async function listRecommendationRows(db, roomId, userId, limit, offset, history) {
  return prepareRecommendationRows(db, roomId, userId, limit, offset, history).all();
}

function recommendationRankingVersion(row) {
  return [
    Number(row.recommendation_count),
    Number(row.vote_count),
    Number(row.vote_sum),
    row.latest_vote_update,
    row.latest_recommendation_update,
  ].join("|");
}

async function getRecommendationRankingVersion(db, roomId) {
  const row = await db.prepare(`
    SELECT COUNT(DISTINCT recommendation.id) AS recommendation_count,
           COUNT(vote.recommendation_id) AS vote_count,
           COALESCE(SUM(vote.value), 0) AS vote_sum,
           COALESCE(MAX(vote.updated_at), '') AS latest_vote_update,
           COALESCE(MAX(recommendation.updated_at), '') AS latest_recommendation_update
    FROM music_recommendations AS recommendation
    LEFT JOIN music_votes AS vote ON vote.recommendation_id = recommendation.id
    WHERE recommendation.room_id = ?
      AND recommendation.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM rooms
        WHERE rooms.id = recommendation.room_id
          AND rooms.is_public = 1
          AND rooms.archived_at IS NULL
      )
  `).bind(roomId).first();
  return recommendationRankingVersion(row);
}

export async function listRecommendations({ request, env, params }) {
  assertDatabase(env);
  const roomId = pathIdentifier({ params }, "roomId");
  await requireOpenRoom(env.DB, roomId);
  const user = await findUser(request, env);
  const url = new URL(request.url);
  const { limit, offset } = parsePage(url);
  const requestedRankingVersion = url.searchParams.get("rankingVersion");
  if (offset > 0 && requestedRankingVersion === null) {
    fail(400, "RANKING_VERSION_REQUIRED", "Envie a versão do placar para carregar a próxima página.");
  }
  if (requestedRankingVersion !== null && requestedRankingVersion.length > 256) {
    fail(400, "INVALID_RANKING_VERSION", "A versão de ordenação é inválida.");
  }
  const initialRankingVersion = await getRecommendationRankingVersion(env.DB, roomId);
  if (requestedRankingVersion !== null && requestedRankingVersion !== initialRankingVersion) {
    fail(409, "RANKING_CHANGED", "A pontuação mudou; atualize o placar antes de continuar.");
  }
  const rows = await prepareRecommendationRows(
    env.DB,
    roomId,
    user?.id ?? null,
    limit,
    offset,
    false,
  ).all();
  const rankingVersion = await getRecommendationRankingVersion(env.DB, roomId);
  if (rankingVersion !== initialRankingVersion) {
    fail(409, "RANKING_CHANGED", "A pontuação mudou; atualize o placar antes de continuar.");
  }
  const hasMore = rows.results.length > limit;
  return jsonResponse({
    recommendations: rows.results.slice(0, limit).map(shapeRecommendation),
    pagination: {
      limit,
      offset,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
      rankingVersion,
    },
  });
}

function parseMusicLink(value) {
  const raw = textField(value, "url", 2048);
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(400, "INVALID_MUSIC_URL", "Informe um link válido do YouTube, Spotify ou SoundCloud.");
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.pathname || url.pathname === "/") {
    fail(400, "INVALID_MUSIC_URL", "Informe um link HTTPS válido de uma faixa.");
  }
  const host = url.hostname.toLowerCase();
  let provider = null;
  if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
    provider = "youtube";
    if (host === "youtu.be" ? !url.pathname.slice(1) : !url.searchParams.get("v") && !/^\/(shorts|embed)\/[^/]+/u.test(url.pathname)) {
      fail(400, "INVALID_MUSIC_URL", "O link do YouTube precisa identificar um vídeo.");
    }
  } else if (host === "open.spotify.com") {
    provider = "spotify";
    if (!/^\/(track|album|playlist|episode|show)\/[A-Za-z0-9]+/u.test(url.pathname)) {
      fail(400, "INVALID_MUSIC_URL", "O link do Spotify precisa identificar uma faixa ou coleção.");
    }
  } else if (host === "soundcloud.com" || host === "www.soundcloud.com" || host === "on.soundcloud.com") {
    provider = "soundcloud";
    if (host !== "on.soundcloud.com" && url.pathname.split("/").filter(Boolean).length < 2) {
      fail(400, "INVALID_MUSIC_URL", "O link do SoundCloud precisa identificar uma faixa.");
    }
  }
  if (!provider) {
    fail(400, "UNSUPPORTED_MUSIC_PROVIDER", "Aceitamos somente links do YouTube, Spotify e SoundCloud.");
  }
  return { provider, url: url.href };
}

export async function createRecommendation({ request, env, params }) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  const roomId = pathIdentifier({ params }, "roomId");
  assertJsonContentType(request);
  const body = await parseJsonObject(request);
  allowOnlyKeys(body, ["title", "artist", "genre", "url"]);
  const title = textField(body.title, "title", 200);
  const artist = textField(body.artist, "artist", 160);
  const genre = textField(body.genre, "genre", 32);
  const musicLink = parseMusicLink(body.url);
  if (!isSupportedGenre(genre)) {
    fail(400, "INVALID_GENRE", "Selecione um gênero disponível na lista.");
  }
  await requireOpenRoom(env.DB, roomId);
  await requireMembership(env.DB, roomId, user.id);

  const id = newId();
  const timestamp = new Date().toISOString();
  const inserted = await env.DB.prepare(`
    INSERT INTO music_recommendations
      (id, room_id, author_id, title, artist, genre, created_at, updated_at, provider, external_url)
    SELECT ?, room.id, ?, ?, ?, ?, ?, ?, ?, ?
    FROM rooms AS room
    JOIN room_participations AS participation
      ON participation.room_id = room.id
     AND participation.user_id = ?
     AND participation.left_at IS NULL
    WHERE room.id = ? AND room.is_public = 1 AND room.archived_at IS NULL
    RETURNING id
  `).bind(
    id,
    user.id,
    title,
    artist,
    genre,
    timestamp,
    timestamp,
    musicLink.provider,
    musicLink.url,
    user.id,
    roomId,
  ).first();

  if (!inserted) {
    await requireOpenRoom(env.DB, roomId);
    await requireMembership(env.DB, roomId, user.id);
    fail(409, "RECOMMENDATION_REJECTED", "Não foi possível registrar a recomendação.");
  }
  const row = await env.DB.prepare(`${RECOMMENDATION_SELECT}
    WHERE recommendation.id = ?
    GROUP BY recommendation.id
  `).bind(null, id).first();
  return jsonResponse({ recommendation: shapeRecommendation(row) }, 201);
}

export async function deleteRecommendation({ request, env, params }) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  const recommendationId = pathIdentifier({ params }, "recommendationId");
  const timestamp = new Date().toISOString();
  const deleted = await env.DB.prepare(`
    UPDATE music_recommendations
    SET deleted_at = ?, updated_at = ?
    WHERE id = ? AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM rooms AS room
        WHERE room.id = music_recommendations.room_id
          AND room.archived_at IS NULL
          AND (
            music_recommendations.author_id = ?
            OR room.owner_id = ?
          )
      )
    RETURNING id
  `).bind(timestamp, timestamp, recommendationId, user.id, user.id).first();
  if (!deleted) {
    const exists = await env.DB.prepare(`
      SELECT recommendation.author_id, recommendation.deleted_at,
             room.owner_id, room.archived_at
      FROM music_recommendations AS recommendation
      JOIN rooms AS room ON room.id = recommendation.room_id
      WHERE recommendation.id = ?
    `).bind(recommendationId).first();
    if (!exists) {
      fail(404, "RECOMMENDATION_NOT_FOUND", "A recomendação não foi encontrada.");
    }
    if (exists.author_id !== user.id && exists.owner_id !== user.id) {
      fail(403, "RECOMMENDATION_OWNER_REQUIRED", "Você não pode remover esta recomendação.");
    }
    if (exists.deleted_at !== null) {
      fail(409, "RECOMMENDATION_REMOVED", "A recomendação já foi removida.");
    }
    if (exists.archived_at !== null) {
      fail(409, "ROOM_ENDED", "Não é possível remover recomendações de uma sala encerrada.");
    }
    fail(409, "RECOMMENDATION_NOT_REMOVED", "Não foi possível remover a recomendação.");
  }
  return jsonResponse({ removed: true, deletedAt: timestamp });
}

async function voteEligibility(db, recommendationId, userId) {
  return db.prepare(`
    SELECT recommendation.author_id, recommendation.deleted_at,
           room.archived_at, room.is_public,
           EXISTS (
             SELECT 1 FROM room_participations AS participation
             WHERE participation.room_id = room.id
               AND participation.user_id = ?
               AND participation.left_at IS NULL
           ) AS is_participant
    FROM music_recommendations AS recommendation
    JOIN rooms AS room ON room.id = recommendation.room_id
    WHERE recommendation.id = ?
  `).bind(userId, recommendationId).first();
}

function assertVoteEligibility(eligibility, userId) {
  if (!eligibility) {
    fail(404, "RECOMMENDATION_NOT_FOUND", "A recomendação não foi encontrada.");
  }
  if (eligibility.deleted_at !== null) {
    fail(409, "RECOMMENDATION_REMOVED", "A recomendação foi removida.");
  }
  if (eligibility.archived_at !== null) {
    fail(409, "ROOM_ENDED", "A sala está encerrada.");
  }
  if (eligibility.is_public !== 1 || !eligibility.is_participant) {
    fail(403, "PARTICIPATION_REQUIRED", "Somente participantes podem votar.");
  }
}

export async function setVote({ request, env, params }) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  const recommendationId = pathIdentifier({ params }, "recommendationId");
  assertJsonContentType(request);
  const body = await parseJsonObject(request);
  allowOnlyKeys(body, ["value"]);
  if (body.value !== 1 && body.value !== -1) {
    fail(400, "INVALID_VOTE", "O voto deve ser 1 ou -1.");
  }

  const timestamp = new Date().toISOString();
  const result = await env.DB.prepare(`
    INSERT INTO music_votes
      (recommendation_id, user_id, value, created_at, updated_at)
    SELECT recommendation.id, ?, ?, ?, ?
    FROM music_recommendations AS recommendation
    JOIN rooms AS room ON room.id = recommendation.room_id
    JOIN room_participations AS participation
      ON participation.room_id = room.id
     AND participation.user_id = ?
     AND participation.left_at IS NULL
    WHERE recommendation.id = ?
      AND recommendation.deleted_at IS NULL
      AND room.is_public = 1
      AND room.archived_at IS NULL
    ON CONFLICT (recommendation_id, user_id) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
    RETURNING recommendation_id, value, created_at, updated_at
  `).bind(
    user.id,
    body.value,
    timestamp,
    timestamp,
    user.id,
    recommendationId,
  ).first();

  if (!result) {
    assertVoteEligibility(await voteEligibility(env.DB, recommendationId, user.id), user.id);
    fail(409, "VOTE_REJECTED", "Não foi possível registrar o voto.");
  }
  const score = await env.DB.prepare(`
    SELECT COALESCE(SUM(value), 0) AS score
    FROM music_votes WHERE recommendation_id = ?
  `).bind(recommendationId).first();
  return jsonResponse({
    vote: {
      recommendationId: result.recommendation_id,
      value: Number(result.value),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    },
    score: Number(score.score),
  });
}

export async function removeVote({ request, env, params }) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  const recommendationId = pathIdentifier({ params }, "recommendationId");
  const removed = await env.DB.prepare(`
    DELETE FROM music_votes
    WHERE recommendation_id = ? AND user_id = ?
      AND EXISTS (
        SELECT 1
        FROM music_recommendations AS recommendation
        JOIN rooms AS room ON room.id = recommendation.room_id
        JOIN room_participations AS participation
          ON participation.room_id = room.id
         AND participation.user_id = music_votes.user_id
         AND participation.left_at IS NULL
        WHERE recommendation.id = music_votes.recommendation_id
          AND recommendation.deleted_at IS NULL
          AND room.is_public = 1
          AND room.archived_at IS NULL
      )
    RETURNING recommendation_id
  `).bind(recommendationId, user.id).first();
  if (!removed) {
    const eligibility = await voteEligibility(env.DB, recommendationId, user.id);
    assertVoteEligibility(eligibility, user.id);
    fail(404, "VOTE_NOT_FOUND", "Você ainda não votou nesta recomendação.");
  }
  const score = await env.DB.prepare(`
    SELECT COALESCE(SUM(value), 0) AS score
    FROM music_votes WHERE recommendation_id = ?
  `).bind(recommendationId).first();
  return jsonResponse({ removed: true, score: Number(score.score) });
}

export async function getRoomHistory({ request, env, params }) {
  assertDatabase(env);
  const roomId = pathIdentifier({ params }, "roomId");
  await requirePublicRoom(env.DB, roomId);
  const { limit, offset } = parsePage(new URL(request.url));
  const user = await findUser(request, env);
  const presenceCutoff = new Date(Date.now() - 90_000).toISOString();

  const [recommendationRows, participationRows, recommendationCount, participationCount] = await Promise.all([
    listRecommendationRows(env.DB, roomId, user?.id ?? null, limit, offset, true),
    env.DB.prepare(`
      SELECT participation.id, participation.joined_at, participation.left_at,
             user.id AS user_id, user.display_name, user.avatar_hash, user.discord_id,
             CASE WHEN participation.left_at IS NOT NULL THEN 'left'
                  WHEN participation.last_seen_at >= ? THEN 'online'
                  ELSE 'offline' END AS presence
      FROM room_participations AS participation
      JOIN users AS user ON user.id = participation.user_id
      WHERE participation.room_id = ?
      ORDER BY participation.joined_at DESC, participation.id ASC
      LIMIT ? OFFSET ?
    `).bind(presenceCutoff, roomId, limit + 1, offset).all(),
    env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM music_recommendations WHERE room_id = ?
    `).bind(roomId).first(),
    env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM room_participations WHERE room_id = ?
    `).bind(roomId).first(),
  ]);

  const recHasMore = recommendationRows.results.length > limit;
  const participantsHaveMore = participationRows.results.length > limit;
  return jsonResponse({
    recommendations: recommendationRows.results.slice(0, limit).map(shapeRecommendation),
    participations: participationRows.results.slice(0, limit).map((row) => ({
      participationId: row.id,
      user: publicPerson(row),
      joinedAt: row.joined_at,
      leftAt: row.left_at,
      presence: row.presence,
    })),
    pagination: {
      limit,
      offset,
      recommendations: {
        hasMore: recHasMore,
        nextOffset: recHasMore ? offset + limit : null,
      },
      participations: {
        hasMore: participantsHaveMore,
        nextOffset: participantsHaveMore ? offset + limit : null,
      },
    },
    counts: {
      recommendations: Number(recommendationCount.count),
      participations: Number(participationCount.count),
    },
  });
}
