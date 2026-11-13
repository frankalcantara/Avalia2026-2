/**
 * Utilitários compartilhados das Cloudflare Pages Functions.
 * Projeto #26 — P26-2B-86B9-E260-A00B-F564
 *
 * Concentra sessão assinada (HMAC), leitura de cookies, schema D1 defensivo
 * e a montagem dos resultados consolidados das enquetes.
 */

const SESSION_COOKIE = "discord_session";
const STATE_COOKIE = "oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS discord_users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    closes_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS poll_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    option_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (poll_id, user_id)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_polls_closes_at ON polls(closes_at)",
  "CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id)",
  "CREATE INDEX IF NOT EXISTS idx_votes_poll ON votes(poll_id)",
  "CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id)",
];

let schemaReady = false;

function getSecret(env) {
  return env.SESSION_SECRET || env.DISCORD_CLIENT_SECRET || "insecure-development-secret";
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function secureFlag(request) {
  return new URL(request.url).protocol === "https:" ? "; Secure" : "";
}

export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((part) => {
    const separator = part.indexOf("=");
    if (separator === -1) return;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = value;
  });
  return cookies;
}

export async function createSessionCookie(env, user, request) {
  const now = Date.now();
  const payload = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        userId: user.userId,
        username: user.username,
        avatar: user.avatar,
        issuedAt: now,
        exp: now + SESSION_TTL_SECONDS * 1000,
      })
    )
  );
  const signature = await hmac(payload, getSecret(env));
  return `${SESSION_COOKIE}=${payload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureFlag(request)}`;
}

export function clearSessionCookie(request) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag(request)}`;
}

export function createStateCookie(state, request) {
  return `${STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secureFlag(request)}`;
}

export function clearStateCookie(request) {
  return `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag(request)}`;
}

export function readStateCookie(request) {
  return parseCookies(request.headers.get("Cookie") || "")[STATE_COOKIE] || "";
}

export async function getSession(request, env) {
  const raw = parseCookies(request.headers.get("Cookie") || "")[SESSION_COOKIE];
  if (!raw) return null;

  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  const expected = await hmac(payload, getSecret(env));
  if (!safeEqual(signature, expected)) return null;

  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (!session || !session.userId || !session.exp || session.exp < Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function upsertSessionUser(env, session) {
  if (!env.DB || !session) return;
  await env.DB.prepare(
    `INSERT INTO discord_users (user_id, username, avatar, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       username = excluded.username,
       avatar = excluded.avatar,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(session.userId, session.username, session.avatar || null)
    .run();
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function ensureSchema(env) {
  if (!env.DB || schemaReady) return;
  await env.DB.batch(SCHEMA_STATEMENTS.map((sql) => env.DB.prepare(sql)));
  schemaReady = true;
}

/**
 * Lê enquetes (todas ou apenas uma) e devolve os dados consolidados:
 * opções, total de votos, percentuais e o voto do usuário autenticado.
 */
export async function loadPolls(env, userId, pollId = null) {
  const pollStatement = pollId
    ? env.DB.prepare(
        "SELECT id, owner_id, owner_name, title, description, closes_at, created_at FROM polls WHERE id = ?"
      ).bind(pollId)
    : env.DB.prepare(
        "SELECT id, owner_id, owner_name, title, description, closes_at, created_at FROM polls ORDER BY id DESC"
      );

  const pollsResult = await pollStatement.all();
  const pollRows = pollsResult.results || [];
  if (pollRows.length === 0) return [];

  const optionsStatement = pollId
    ? env.DB.prepare(
        "SELECT id, poll_id, label, position FROM poll_options WHERE poll_id = ? ORDER BY position, id"
      ).bind(pollId)
    : env.DB.prepare(
        "SELECT id, poll_id, label, position FROM poll_options ORDER BY poll_id, position, id"
      );

  const countsStatement = pollId
    ? env.DB.prepare(
        "SELECT poll_id, option_id, COUNT(*) AS total FROM votes WHERE poll_id = ? GROUP BY poll_id, option_id"
      ).bind(pollId)
    : env.DB.prepare(
        "SELECT poll_id, option_id, COUNT(*) AS total FROM votes GROUP BY poll_id, option_id"
      );

  const [optionsResult, countsResult] = await env.DB.batch([optionsStatement, countsStatement]);
  const optionRows = optionsResult.results || [];
  const countRows = countsResult.results || [];

  let userVoteRows = [];
  if (userId) {
    const userVoteStatement = pollId
      ? env.DB.prepare("SELECT poll_id, option_id FROM votes WHERE user_id = ? AND poll_id = ?").bind(
          userId,
          pollId
        )
      : env.DB.prepare("SELECT poll_id, option_id FROM votes WHERE user_id = ?").bind(userId);
    const userVoteResult = await userVoteStatement.all();
    userVoteRows = userVoteResult.results || [];
  }

  const optionsByPoll = new Map();
  optionRows.forEach((option) => {
    if (!optionsByPoll.has(option.poll_id)) optionsByPoll.set(option.poll_id, []);
    optionsByPoll.get(option.poll_id).push(option);
  });

  const countsByPoll = new Map();
  countRows.forEach((row) => {
    if (!countsByPoll.has(row.poll_id)) countsByPoll.set(row.poll_id, new Map());
    countsByPoll.get(row.poll_id).set(row.option_id, Number(row.total) || 0);
  });

  const userVotes = new Map(userVoteRows.map((row) => [row.poll_id, row.option_id]));
  const now = Date.now();

  return pollRows.map((poll) => {
    const optionCounts = countsByPoll.get(poll.id) || new Map();
    const options = (optionsByPoll.get(poll.id) || []).map((option) => ({
      id: option.id,
      label: option.label,
      votes: optionCounts.get(option.id) || 0,
    }));

    const totalVotes = options.reduce((sum, option) => sum + option.votes, 0);
    const consolidatedOptions = options.map((option) => ({
      ...option,
      percentage: totalVotes > 0 ? Math.round((option.votes / totalVotes) * 1000) / 10 : 0,
    }));

    const closesAt = poll.closes_at;
    const closed = new Date(closesAt).getTime() <= now;

    return {
      id: poll.id,
      ownerId: poll.owner_id,
      ownerName: poll.owner_name,
      title: poll.title,
      description: poll.description,
      closesAt,
      createdAt: poll.created_at,
      closed,
      totalVotes,
      options: consolidatedOptions,
      userVoteOptionId: userVotes.has(poll.id) ? userVotes.get(poll.id) : null,
    };
  });
}
