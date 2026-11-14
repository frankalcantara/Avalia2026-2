/** Shared, dependency-free helpers for Cloudflare Pages Functions. */
export const PROJECT_KEY = "P26-2A-DE92-BEA1-D95B-F329";
export const SESSION_COOKIE = "__Host-portfolio_session";
export const OAUTH_COOKIE = "__Host-portfolio_oauth";
export const SESSION_TTL = 7 * 24 * 60 * 60;
export const BODY_LIMIT = 96 * 1024;

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export function withErrors(handler) {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.code, message: error.message }, error.status);
      }
      // Never send queries, OAuth responses, tokens or stack traces to clients.
      return json({ error: "internal_error", message: "Não foi possível concluir a operação. Tente novamente." }, 500);
    }
  };
}

export function methodAllowed(request, methods) {
  if (!methods.includes(request.method)) throw new HttpError(405, "method_not_allowed", "Método HTTP não permitido.");
}
export function requireDb(env) {
  if (!env.DB) throw new HttpError(503, "database_unavailable", "O banco de dados ainda não está configurado.");
  return env.DB;
}
export function requireSecret(env) {
  if (typeof env.SESSION_SECRET !== "string" || env.SESSION_SECRET.length < 32) {
    throw new HttpError(503, "session_not_configured", "A autenticação ainda não está configurada.");
  }
  return env.SESSION_SECRET;
}
export function requireOAuth(env) {
  requireDb(env);
  requireSecret(env);
  if (!/^\d{5,25}$/.test(env.DISCORD_CLIENT_ID || "") || !env.DISCORD_CLIENT_SECRET) {
    throw new HttpError(503, "discord_not_configured", "O login pelo Discord ainda não está configurado.");
  }
}

const encoder = new TextEncoder();
function encodeBase64(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeBase64(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_base64");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}
export function randomToken() {
  return encodeBase64(crypto.getRandomValues(new Uint8Array(32)));
}
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function signValue(value, secret) {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(value));
  return `${value}.${encodeBase64(new Uint8Array(signature))}`;
}
export async function verifySignedValue(signed, secret) {
  if (typeof signed !== "string" || signed.length > 1024) return null;
  const split = signed.lastIndexOf(".");
  if (split <= 0) return null;
  const value = signed.slice(0, split);
  try {
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), decodeBase64(signed.slice(split + 1)), encoder.encode(value));
    return valid ? value : null;
  } catch { return null; }
}
export async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(bytes)].map((n) => n.toString(16).padStart(2, "0")).join("");
}
export function parseCookies(request) {
  const result = Object.create(null);
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    if (Object.prototype.hasOwnProperty.call(result, name)) result[name] = "";
    else result[name] = part.slice(index + 1).trim();
  }
  return result;
}
export function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  for (const item of cookies) headers.append("Set-Cookie", item);
  return new Response(null, { status: 302, headers });
}
export function avatarUrl(user) {
  const hash = typeof user.avatar === "string" && /^[A-Za-z0-9_]{1,128}$/.test(user.avatar) ? user.avatar : null;
  if (hash) return `https://cdn.discordapp.com/avatars/${user.user_id}/${hash}.png?size=128`;
  const index = Number((BigInt(user.user_id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export async function getSession(request, env) {
  const signed = parseCookies(request)[SESSION_COOKIE];
  if (!signed) return null;
  const token = await verifySignedValue(signed, requireSecret(env));
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const row = await requireDb(env).prepare(
    `SELECT s.token_hash, s.csrf_token, s.expires_at, u.user_id, u.username, u.avatar
     FROM sessions s JOIN discord_users u ON u.user_id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  ).bind(await digest(token), new Date().toISOString()).first();
  if (!row) return null;
  return {
    token_hash: row.token_hash,
    csrf_token: row.csrf_token,
    user: { user_id: row.user_id, username: row.username, avatar_url: avatarUrl(row) },
  };
}
export async function requireSession(request, env) {
  const session = await getSession(request, env);
  if (!session) throw new HttpError(401, "unauthenticated", "Entre com o Discord para continuar.");
  return session;
}
export function requireCsrf(request, session) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) throw new HttpError(403, "invalid_origin", "Origem da solicitação não permitida.");
  const token = request.headers.get("X-CSRF-Token");
  if (!token || token !== session.csrf_token) throw new HttpError(403, "invalid_csrf", "Sua sessão precisa ser atualizada. Recarregue a página.");
}

export async function readJson(request) {
  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new HttpError(415, "json_required", "Envie os dados no formato JSON.");
  const length = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(length) && length > BODY_LIMIT) throw new HttpError(413, "payload_too_large", "O currículo excede o tamanho permitido.");
  if (!request.body) throw new HttpError(400, "invalid_json", "O corpo da solicitação está vazio.");
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > BODY_LIMIT) {
      await reader.cancel();
      throw new HttpError(413, "payload_too_large", "O currículo excede o tamanho permitido.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, "invalid_json", "O JSON enviado é inválido."); }
}

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "invalid_curriculum", `${label}: informe um objeto válido.`);
  return value;
}
function text(value, label, max, min = 0) {
  if (value === undefined) value = "";
  if (typeof value !== "string") throw new HttpError(400, "invalid_field", `${label}: informe um texto.`);
  const clean = value.trim().replace(/\r\n?/g, "\n");
  if (clean.length < min || clean.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(clean)) throw new HttpError(400, "invalid_field", `${label}: use entre ${min} e ${max} caracteres válidos.`);
  return clean;
}
function url(value, label) {
  const clean = text(value, label, 500);
  if (!clean) return "";
  let parsed;
  try { parsed = new URL(clean); } catch { throw new HttpError(400, "invalid_url", `${label}: informe uma URL completa com https:// ou http://.`); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new HttpError(400, "invalid_url", `${label}: somente links HTTP ou HTTPS sem credenciais são permitidos.`);
  return clean;
}
function entries(value, label, max, fields) {
  if (value === undefined) value = [];
  if (!Array.isArray(value) || value.length > max) throw new HttpError(400, "invalid_list", `${label}: informe uma lista com até ${max} itens.`);
  return value.map((item, index) => {
    object(item, `${label} ${index + 1}`);
    const result = {};
    for (const [key, limit] of Object.entries(fields)) result[key] = limit === "url" ? url(item[key], `${label}: ${key}`) : text(item[key], `${label}: ${key}`, limit);
    return result;
  });
}
export function validateCurriculum(input) {
  object(input, "Currículo");
  const p = object(input.profile, "Dados profissionais");
  const profile = {
    full_name: text(p.full_name, "Nome completo", 120, 2), headline: text(p.headline, "Título profissional", 180),
    email: text(p.email, "Email", 254), phone: text(p.phone, "Telefone", 40), location: text(p.location, "Localização", 160),
    website: url(p.website, "Website"), summary: text(p.summary, "Resumo", 4000),
  };
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) throw new HttpError(400, "invalid_email", "Informe um email válido.");
  const theme = input.theme === undefined ? "modern" : input.theme;
  if (!["modern", "classic", "minimal"].includes(theme)) throw new HttpError(400, "invalid_theme", "Escolha um dos três temas disponíveis.");
  const isPublic = input.is_public === undefined ? false : input.is_public;
  if (typeof isPublic !== "boolean") throw new HttpError(400, "invalid_visibility", "A opção de publicação deve ser verdadeira ou falsa.");
  return {
    profile,
    education: entries(input.education, "Formação", 20, { institution: 200, course: 200, start: 30, end: 30, description: 4000 }),
    experience: entries(input.experience, "Experiência", 20, { company: 200, role: 200, start: 30, end: 30, description: 4000 }),
    projects: entries(input.projects, "Projetos", 20, { name: 200, description: 4000, url: "url", repository: "url", technologies: 200 }),
    skills: entries(input.skills, "Habilidades", 50, { name: 100, level: 60 }),
    links: entries(input.links, "Links", 15, { label: 100, url: "url" }), theme, is_public: isPublic,
  };
}

const collections = {
  education: ["institution", "course", "start", "end", "description"], experience: ["company", "role", "start", "end", "description"],
  projects: ["name", "description", "url", "repository", "technologies"], skills: ["name", "level"], links: ["label", "url"],
};
export function emptyCurriculum(user) {
  return {
    user_id: user.user_id,
    profile: { full_name: "", headline: "", email: "", phone: "", location: "", website: "", summary: "" },
    education: [], experience: [], projects: [], skills: [], links: [], theme: "modern", is_public: false, updated_at: null,
  };
}
export async function loadCurriculum(db, userId, { publicOnly = false } = {}) {
  const where = publicOnly ? "user_id = ? AND is_public = 1" : "user_id = ?";
  const names = Object.keys(collections);
  const batches = await db.batch([
    db.prepare(`SELECT * FROM curricula WHERE ${where}`).bind(userId),
    ...names.map((name) => db.prepare(`SELECT ${collections[name].map((column) => `"${column}"`).join(", ")} FROM curriculum_${name} WHERE user_id = ? ORDER BY position`).bind(userId)),
  ]);
  const row = batches[0].results?.[0];
  if (!row) return null;
  const result = {
    user_id: row.user_id,
    profile: Object.fromEntries(["full_name", "headline", "email", "phone", "location", "website", "summary"].map((field) => [field, row[field]])),
    theme: row.theme, is_public: row.is_public === 1, updated_at: row.updated_at,
  };
  for (let i = 0; i < names.length; i++) result[names[i]] = batches[i + 1].results || [];
  return result;
}
export async function saveCurriculum(db, userId, data) {
  const updatedAt = new Date().toISOString();
  const p = data.profile;
  const statements = [db.prepare(
    `INSERT INTO curricula (user_id, full_name, headline, email, phone, location, website, summary, theme, is_public, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name, headline=excluded.headline, email=excluded.email,
       phone=excluded.phone, location=excluded.location, website=excluded.website, summary=excluded.summary,
       theme=excluded.theme, is_public=excluded.is_public, updated_at=excluded.updated_at`
  ).bind(userId, p.full_name, p.headline, p.email, p.phone, p.location, p.website, p.summary, data.theme, data.is_public ? 1 : 0, updatedAt)];
  for (const [name, fields] of Object.entries(collections)) {
    statements.push(db.prepare(`DELETE FROM curriculum_${name} WHERE user_id = ?`).bind(userId));
    const columns = ["user_id", "position", ...fields].map((column) => `"${column}"`).join(", ");
    // Keep each statement below D1's parameter cap and each save below free-plan query limits.
    const width = fields.length + 2;
    const chunkSize = Math.floor(90 / width);
    for (let offset = 0; offset < data[name].length; offset += chunkSize) {
      const chunk = data[name].slice(offset, offset + chunkSize);
      const values = chunk.flatMap((item, index) => [userId, offset + index, ...fields.map((field) => item[field])]);
      const placeholders = chunk.map(() => `(${Array(width).fill("?").join(", ")})`).join(", ");
      statements.push(db.prepare(`INSERT INTO curriculum_${name} (${columns}) VALUES ${placeholders}`).bind(...values));
    }
  }
  await db.batch(statements);
  return { ...data, user_id: userId, updated_at: updatedAt };
}
