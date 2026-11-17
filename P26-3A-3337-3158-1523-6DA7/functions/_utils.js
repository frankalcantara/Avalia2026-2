/**
 * Utilitarios compartilhados pelas Cloudflare Pages Functions.
 * Arquivo com prefixo "_" e sem exports onRequest*: nao vira rota publica.
 *
 * Sessao: cookie HttpOnly assinado com HMAC-SHA256 (Web Crypto). O cliente nao
 * consegue forjar nem alterar userId/username/avatar sem conhecer o segredo.
 * O segredo e SESSION_SECRET (opcional); se ausente, usa DISCORD_CLIENT_SECRET.
 */

export const CHAVE_PROJETO = "P26-3A-3337-3158-1523-6DA7";
export const CATEGORIES = ["ensino", "pesquisa", "extensao"];
export const CATEGORY_LABELS = {
  ensino: "Ensino",
  pesquisa: "Pesquisa",
  extensao: "Extensão",
};
export const CAP_PER_CATEGORY = 60; // teto de horas por modalidade
export const TOTAL_REQUIRED = 180; // 3 eixos x 60h = exigencia curricular
export const SESSION_COOKIE = "discord_session";
export const STATE_COOKIE = "discord_oauth_state";
export const SESSION_TTL_SECONDS = 24 * 60 * 60;
export const HOURS_EPSILON = 1e-6; // tolerancia de ponto flutuante nas somas

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

/* ---------- Cookies ---------- */

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function buildCookie(name, value, { maxAge, path = "/" } = {}) {
  return `${name}=${value}; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/* ---------- Base64url ---------- */

function bytesToB64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(str) {
  const b64 =
    str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- Sessao assinada (HMAC-SHA256) ---------- */

export function getSecret(env) {
  return (env && (env.SESSION_SECRET || env.DISCORD_CLIENT_SECRET)) || null;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode("horas-complementares-session:" + secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(user, env, nowMs = Date.now()) {
  const secret = getSecret(env);
  if (!secret) throw new Error("missing_session_secret");
  const payload = bytesToB64url(
    encoder.encode(
      JSON.stringify({
        uid: String(user.userId),
        un: String(user.username || "").slice(0, 80),
        av: user.avatar ? String(user.avatar) : null,
        exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS,
      })
    )
  );
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return payload + "." + bytesToB64url(new Uint8Array(sig));
}

/** Retorna {userId, username, avatar} se o cookie for valido, assinado e nao expirado; senao null. */
export async function getSessionUser(request, env, nowMs = Date.now()) {
  const secret = getSecret(env);
  if (!secret) return null;
  const raw = getCookie(request, SESSION_COOKIE);
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      b64urlToBytes(parts[1]),
      encoder.encode(parts[0])
    );
    if (!ok) return null;
    const data = JSON.parse(decoder.decode(b64urlToBytes(parts[0])));
    if (!data || typeof data.exp !== "number" || data.exp <= nowMs / 1000) return null;
    if (!/^\d{5,25}$/.test(String(data.uid))) return null;
    return {
      userId: String(data.uid),
      username: String(data.un || "").slice(0, 80),
      avatar: data.av ? String(data.av) : null,
    };
  } catch {
    return null;
  }
}

/* ---------- Validacoes ---------- */

export function isValidUrl(value) {
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && Boolean(u.hostname);
  } catch {
    return false;
  }
}

/** Normaliza a categoria (aceita "Extensão"/"extensao"); retorna null se invalida. */
export function normalizeCategory(value) {
  if (typeof value !== "string") return null;
  const c = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return CATEGORIES.includes(c) ? c : null;
}

/**
 * Aceita numero ou string numerica com NO MAXIMO 2 casas decimais (sem arredondar em silencio).
 * Retorna as horas como numero positivo, ou null se invalido.
 */
export function parseHours(value) {
  let n;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && /^\d+([.,]\d{1,2})?$/.test(value.trim()))
    n = Number(value.trim().replace(",", "."));
  else return null;
  if (!Number.isFinite(n) || n <= 0) return null;
  const cents = Math.round(n * 100);
  if (cents <= 0 || Math.abs(n * 100 - cents) > 1e-6) return null; // mais de 2 casas
  return cents / 100;
}

/** Bloqueia requisicoes de escrita vindas de outra origem (defesa adicional ao SameSite=Lax). */
export function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/* ---------- Banco D1 ---------- */

const schemaReady = new WeakSet();

/** Garante o esquema mesmo se a migracao ainda nao foi aplicada (identico a migrations/0001_init.sql). */
export async function ensureSchema(env) {
  if (!env || !env.DB || schemaReady.has(env.DB)) return;
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS discord_users (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        avatar TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('ensino','pesquisa','extensao')),
        title TEXT NOT NULL,
        hours REAL NOT NULL CHECK (hours > 0),
        certificate_url TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES discord_users(user_id)
      )`
    ),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id)"),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_activities_user_cat ON activities(user_id, category)"
    ),
  ]);
  schemaReady.add(env.DB);
}

export async function upsertDiscordUser(env, user) {
  await env.DB.prepare(
    "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
  )
    .bind(user.userId, user.username, user.avatar || null)
    .run();
}
