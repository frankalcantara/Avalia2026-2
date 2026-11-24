// Utilidades para executar as Pages Functions reais em Node:
// ambiente (env), usuários/sessões direto no banco, chamada de handlers e
// fetch simulado do Discord (nenhum teste acessa a rede).

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { webcrypto } from "node:crypto";
import { createD1 } from "./d1.mjs";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
export const BASE_URL = "https://teste.pages.dev";
export const CLIENT_ID = "123456789012345678";
export const CLIENT_SECRET = "segredo-de-teste-nao-vazar";
export const KEY = "P26-3A-DAD6-042E-642E-9A58";

const subtle = (globalThis.crypto ?? webcrypto).subtle;

// ---------- módulos das Functions ----------

export const ROUTES = {
  login: "functions/api/auth/discord.js",
  callback: "functions/api/auth/discord/callback.js",
  logout: "functions/api/auth/logout.js",
  me: "functions/api/me.js",
  events: "functions/api/events/index.js",
  event: "functions/api/events/[id].js",
  rsvp: "functions/api/events/[id]/rsvp.js",
};

export function routeExists(name) {
  return existsSync(path.join(ROOT, ROUTES[name]));
}

export function allRoutesExist(...names) {
  return names.every(routeExists);
}

const cache = new Map();
export async function load(name) {
  if (!cache.has(name)) {
    const url = pathToFileURL(path.join(ROOT, ROUTES[name])).href;
    cache.set(name, import(url));
  }
  return cache.get(name);
}

// ---------- ambiente ----------

export async function makeEnv(overrides = {}) {
  const DB = await createD1();
  return {
    DB,
    DISCORD_CLIENT_ID: CLIENT_ID,
    DISCORD_CLIENT_SECRET: CLIENT_SECRET,
    PUBLIC_BASE_URL: BASE_URL,
    ...overrides,
  };
}

// ---------- cripto (mesmo formato do contrato) ----------

export function b64url(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sha256b64url(text) {
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return b64url(new Uint8Array(digest));
}

export function randomToken(bytes = 32) {
  const b = new Uint8Array(bytes);
  (globalThis.crypto ?? webcrypto).getRandomValues(b);
  return b64url(b); // 43 caracteres para 32 bytes
}

// ---------- dados direto no banco ----------

let userSeq = 0;
export function nextUserId() {
  userSeq += 1;
  // snowflake plausível e único
  return String(80351110224678912n + BigInt(userSeq) * 4194304n);
}

export async function createUser(env, fields = {}) {
  const user = {
    user_id: fields.user_id ?? nextUserId(),
    username: fields.username ?? `usuario${userSeq}`,
    global_name: fields.global_name ?? null,
    avatar: fields.avatar ?? null,
  };
  env.DB.query(
    "INSERT INTO discord_users (user_id, username, global_name, avatar, updated_at) VALUES (?, ?, ?, ?, ?)",
    [user.user_id, user.username, user.global_name, user.avatar, Date.now()],
  );
  return user;
}

export async function createSession(env, userId, { expiresIn = 8 * 3600e3 } = {}) {
  const token = randomToken(32);
  const idHash = await sha256b64url(token);
  const now = Date.now();
  env.DB.query(
    "INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    [idHash, userId, now + expiresIn, now],
  );
  return `__Host-session=${token}`;
}

// Cria usuário + sessão e devolve { user, cookie }.
export async function login(env, fields = {}) {
  const user = await createUser(env, fields);
  const cookie = await createSession(env, user.user_id);
  return { user, cookie };
}

// Data AAAA-MM-DD no fuso America/Sao_Paulo, deslocada em dias.
export function spDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400e3);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Insere evento direto no banco (para testes que não dependem do POST).
export function insertEvent(env, creatorId, fields = {}) {
  env.DB.query(
    `INSERT INTO events (creator_id, title, description, location, event_date, event_time, capacity, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      creatorId,
      fields.title ?? "Evento de teste",
      fields.description ?? null,
      fields.location ?? "Sala 1",
      fields.date ?? spDate(7),
      fields.time ?? "19:00",
      fields.capacity ?? 2,
      Date.now(),
    ],
  );
  return env.DB.query("SELECT last_insert_rowid() AS id")[0].id;
}

// ---------- chamada de handler ----------

const METHOD_EXPORT = {
  GET: "onRequestGet",
  POST: "onRequestPost",
  DELETE: "onRequestDelete",
  PUT: "onRequestPut",
  PATCH: "onRequestPatch",
  HEAD: "onRequestHead",
  OPTIONS: "onRequestOptions",
};

/**
 * Invoca o handler do módulo como o runtime do Pages faria.
 * opts.origin: undefined => usa PUBLIC_BASE_URL em POST/DELETE; null => sem Origin.
 */
export async function call(mod, method, opts = {}) {
  const { env, path: p = "/", params = {}, body, cookie, origin, headers = {} } = opts;
  if (!env) throw new Error("call(): env obrigatório");
  const h = new Headers(headers);
  if (cookie) h.set("Cookie", Array.isArray(cookie) ? cookie.join("; ") : cookie);
  const mutating = !["GET", "HEAD"].includes(method);
  const o = origin === undefined ? (mutating ? BASE_URL : undefined) : origin;
  if (o) h.set("Origin", o);
  let reqBody;
  if (body !== undefined) {
    reqBody = typeof body === "string" ? body : JSON.stringify(body);
    if (!h.has("Content-Type")) h.set("Content-Type", "application/json");
  }
  const request = new Request(new URL(p, BASE_URL), {
    method,
    headers: h,
    body: reqBody,
    redirect: "manual",
  });

  const handler = mod[METHOD_EXPORT[method]] ?? mod.onRequest;
  let res;
  if (!handler) {
    res = new Response(null, { status: 405 });
  } else {
    const waits = [];
    res = await handler({
      request,
      env,
      params,
      data: {},
      functionPath: p,
      waitUntil: (pr) => waits.push(pr),
      passThroughOnException: () => {},
      next: async () => new Response("não encontrado", { status: 404 }),
    });
    await Promise.allSettled(waits);
  }
  if (!(res instanceof Response)) {
    throw new Error(`handler ${method} ${p} não devolveu Response`);
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* corpo não-JSON */
  }
  return {
    status: res.status,
    headers: res.headers,
    setCookies: res.headers.getSetCookie ? res.headers.getSetCookie() : [],
    location: res.headers.get("Location"),
    text,
    json,
    res,
  };
}

// Extrai "nome=valor" de uma lista de Set-Cookie.
export function cookieFrom(setCookies, name) {
  const line = setCookies.find((c) => c.startsWith(`${name}=`));
  if (!line) return null;
  return { pair: line.split(";")[0], value: line.split(";")[0].slice(name.length + 1), line };
}

// ---------- fetch simulado do Discord ----------

/**
 * Substitui globalThis.fetch. Devolve { calls, restore }.
 * profile: objeto devolvido em /users/@me.
 */
export function mockDiscordFetch({
  profile = { id: "80351110224678912", username: "nelly", global_name: "Nelly", avatar: "8342729096ea3675442027381ff50dfe" },
  tokenStatus = 200,
  meStatus = 200,
  revokeStatus = 200,
} = {}) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    let body = "";
    try {
      body = await req.clone().text();
    } catch {
      /* sem corpo */
    }
    calls.push({ url: req.url, method: req.method, headers: req.headers, body });
    if (url.hostname !== "discord.com" && url.hostname !== "discordapp.com") {
      throw new Error(`rede bloqueada nos testes: ${req.url}`);
    }
    const p = url.pathname.replace(/^\/api(\/v\d+)?/, "");
    const json = (status, obj) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (p === "/oauth2/token" && req.method === "POST") {
      if (tokenStatus !== 200) return json(tokenStatus, { error: "invalid_grant" });
      return json(200, {
        access_token: "access-token-falso",
        token_type: "Bearer",
        expires_in: 604800,
        refresh_token: "refresh-token-falso",
        scope: "identify",
      });
    }
    if (p === "/users/@me") {
      if (meStatus !== 200) return json(meStatus, { message: "401: Unauthorized" });
      return json(200, profile);
    }
    if (p === "/oauth2/token/revoke") {
      return new Response(revokeStatus === 200 ? "{}" : "erro", { status: revokeStatus });
    }
    return json(404, { message: "rota desconhecida no mock" });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

// Contagens úteis para os invariantes.
export function counts(env, eventId) {
  const row = env.DB.query(
    `SELECT
       SUM(status = 'confirmed') AS confirmed,
       SUM(status = 'waitlist') AS waitlist,
       (SELECT capacity FROM events WHERE id = ?1) AS capacity
     FROM registrations WHERE event_id = ?1`,
    [eventId],
  )[0];
  return {
    confirmed: row.confirmed ?? 0,
    waitlist: row.waitlist ?? 0,
    capacity: row.capacity,
  };
}
