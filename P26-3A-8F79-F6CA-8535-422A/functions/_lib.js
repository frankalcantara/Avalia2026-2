// Lógica compartilhada das Pages Functions (arquivos com "_" não viram rota).

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 dias, em segundos
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I/L

export const json = (data, status = 200, headers) =>
  Response.json(data, { status, headers });

export const error = (status, message) => json({ error: message }, status);

// Pages não devolve 405 sozinho (cairia no index.html): cada rota exporta isto como onRequest,
// que só roda quando nenhum onRequest<Método> casa.
export const methodNotAllowed = () => error(405, "Método não permitido.");

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- cookies e sessão ----------

export function getCookie(request, name) {
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export const cookie = (name, value, maxAge, path = "/") =>
  `${name}=${value}; Max-Age=${maxAge}; Path=${path}; HttpOnly; Secure; SameSite=Lax`;

const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

function hmacKey(env) {
  if (!env.SESSION_SECRET) throw new HttpError(500, "Servidor sem SESSION_SECRET configurado.");
  return crypto.subtle.importKey(
    "raw", enc.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

export async function sessionCookie(env, uid) {
  const payload = b64url(enc.encode(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + SESSION_TTL })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(payload));
  return cookie("session", `${payload}.${b64url(new Uint8Array(sig))}`, SESSION_TTL);
}

export const clearCookie = (name, path = "/") => cookie(name, "", 0, path);

// Devolve o user_id da sessão válida, ou null.
export async function readSession(request, env) {
  const raw = getCookie(request, "session");
  const key = await hmacKey(env);
  if (!raw) return null;
  const [payload, sig, extra] = raw.split(".");
  if (!payload || !sig || extra !== undefined) return null;
  try {
    // só a grafia canônica (atob ignora bits de preenchimento e "="): uma sessão = um cookie
    if (sig.length !== 43 || ![payload, sig].every((s) => /^[A-Za-z0-9_-]+$/.test(s) && b64url(unb64url(s)) === s)) return null;
    const ok = await crypto.subtle.verify("HMAC", key, unb64url(sig), enc.encode(payload));
    if (!ok) return null;
    const { uid, exp } = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    if (typeof uid !== "string" || typeof exp !== "number" || exp <= Date.now() / 1000) return null;
    return uid;
  } catch {
    return null; // base64/JSON inválido
  }
}

export async function requireUser(request, env) {
  const uid = await readSession(request, env);
  if (!uid) throw new HttpError(401, "Sessão inválida ou expirada.");
  return uid;
}

// ---------- entrada ----------

export async function readBody(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Corpo JSON inválido.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Corpo JSON inválido.");
  return body;
}

// :id da rota precisa ser inteiro positivo; caso contrário a rota "não existe".
export function routeId(params) {
  if (!/^[1-9]\d{0,15}$/.test(params.id || "")) throw new HttpError(404, "Não encontrado.");
  return Number(params.id);
}

export function cleanText(value, max, field) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < 1 || text.length > max) throw new HttpError(400, `${field} deve ter de 1 a ${max} caracteres.`);
  return text;
}

export function shareCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  // 248 = 8 * 31: descarta bytes altos para não enviesar o alfabeto de 31 símbolos
  for (let i = 0; i < 8; i++) while (bytes[i] >= 248) bytes[i] = crypto.getRandomValues(new Uint8Array(1))[0];
  return Array.from(bytes, (b) => CODE_ALPHABET[b % 31]).join("");
}

// ---------- acesso e consultas ----------

export async function memberRole(env, listId, uid) {
  const row = await env.DB.prepare("SELECT role FROM list_members WHERE list_id = ? AND user_id = ?")
    .bind(listId, uid).first();
  return row ? row.role : null;
}

// 404 tanto para lista inexistente quanto para não membro (não revela a lista).
export async function requireMember(env, listId, uid) {
  if (!(await memberRole(env, listId, uid))) throw new HttpError(404, "Lista não encontrada.");
}

const LIST_SELECT = `
  SELECT l.id, l.name, l.share_code, m.role,
    (SELECT COUNT(*) FROM list_members WHERE list_id = l.id) AS member_count,
    (SELECT COUNT(*) FROM tasks WHERE list_id = l.id) AS task_count,
    (SELECT COUNT(*) FROM tasks WHERE list_id = l.id AND done = 1) AS done_count
  FROM lists l JOIN list_members m ON m.list_id = l.id AND m.user_id = ?`;

const TASK_SELECT = `
  SELECT t.id, t.parent_id, t.title, t.done, t.created_by, t.updated_at,
    u.user_id AS a_id, u.username AS a_username, u.avatar AS a_avatar
  FROM tasks t LEFT JOIN users u ON u.user_id = t.assignee_id`;

export const toUser = (r) => ({ id: r.user_id, username: r.username, avatarUrl: r.avatar });

export const toList = (r) => ({
  id: r.id, name: r.name, shareCode: r.share_code, role: r.role,
  memberCount: r.member_count, taskCount: r.task_count, doneCount: r.done_count,
});

export const toTask = (r) => ({
  id: r.id,
  parentId: r.parent_id,
  title: r.title,
  done: r.done === 1,
  assignee: r.a_id ? { id: r.a_id, username: r.a_username, avatarUrl: r.a_avatar } : null,
  createdBy: r.created_by,
  updatedAt: r.updated_at,
});

export async function myLists(env, uid) {
  const { results } = await env.DB.prepare(`${LIST_SELECT} ORDER BY l.id DESC`).bind(uid).all();
  return results.map(toList);
}

export async function myList(env, uid, listId) {
  const row = await env.DB.prepare(`${LIST_SELECT} WHERE l.id = ?`).bind(uid, listId).first();
  return row ? toList(row) : null;
}

export async function listTasks(env, listId) {
  // tarefa principal seguida das suas subtarefas
  const { results } = await env.DB.prepare(
    `${TASK_SELECT} WHERE t.list_id = ? ORDER BY COALESCE(t.parent_id, t.id), t.parent_id IS NOT NULL, t.id`
  ).bind(listId).all();
  return results.map(toTask);
}

export async function getTask(env, taskId) {
  const row = await env.DB.prepare(`${TASK_SELECT} WHERE t.id = ?`).bind(taskId).first();
  return row ? toTask(row) : null;
}

// assigneeId: null/ausente = sem responsável; senão precisa ser membro da lista.
export async function checkAssignee(env, listId, assigneeId) {
  if (assigneeId === null || assigneeId === undefined) return null;
  if (typeof assigneeId !== "string" || !(await memberRole(env, listId, assigneeId))) {
    throw new HttpError(400, "Responsável precisa ser membro da lista.");
  }
  return assigneeId;
}
