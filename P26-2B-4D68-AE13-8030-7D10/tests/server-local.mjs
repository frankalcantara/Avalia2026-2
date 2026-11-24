#!/usr/bin/env node
// Servidor local mínimo que executa as Pages Functions no Node (node:sqlite).
// Uso: node tests/server-local.mjs [porta]   (padrão 8788, igual ao E2E_BASE)
// Ele imita o roteamento do Cloudflare Pages: functions/api/articles/[id].js -> /api/articles/:id
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { createServer } from "node:http";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.argv[2] || process.env.PORT || 8788);

// .env simples: SESSION_SECRET=... (o mesmo arquivo que o tests/e2e.mjs lê)
const envFile = join(root, ".env");
const fileEnv = existsSync(envFile)
  ? Object.fromEntries(readFileSync(envFile, "utf8").split(/\r?\n/)
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]))
  : {};

const database = new DatabaseSync(process.env.DB_FILE || ":memory:");
database.exec(readFileSync(join(root, "schema.sql"), "utf8"));

// Dados de exemplo + os dois usuários usados pelo tests/e2e.mjs.
database.exec(readFileSync(join(root, "seed", "demo-local.sql"), "utf8"));
database.prepare("INSERT OR IGNORE INTO discord_users (user_id, username, avatar) VALUES (?, ?, NULL)")
  .run("200000000000000002", "Bruno Teste");

function statement(sql, args = []) {
  return {
    bind: (...next) => statement(sql, next),
    async first(column) {
      const row = database.prepare(sql).get(...args) ?? null;
      if (!row) return null;
      return column ? row[column] ?? null : row;
    },
    async all() {
      return { success: true, results: database.prepare(sql).all(...args), meta: {} };
    },
    async run() {
      const info = database.prepare(sql).run(...args);
      return {
        success: true,
        meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
      };
    },
  };
}

const DB = {
  prepare: (sql) => statement(sql),
  batch: async (statements) => Promise.all(statements.map((item) => item.run())),
  exec: async (sql) => database.exec(sql),
};

const env = {
  DB,
  SESSION_SECRET: process.env.SESSION_SECRET || fileEnv.SESSION_SECRET || "",
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || fileEnv.DISCORD_CLIENT_ID || "000000000000000000",
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || fileEnv.DISCORD_CLIENT_SECRET || "test-secret",
};

if (env.SESSION_SECRET.length < 32) {
  console.error("Defina SESSION_SECRET (32+ caracteres) no .env antes de subir o servidor local.");
  process.exit(1);
}

// ---- Rotas a partir da pasta functions/ -----------------------------------
const routes = [];
function walk(dir, segments = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "_lib") continue;
      walk(full, [...segments, entry]);
      continue;
    }
    if (!entry.endsWith(".js") || entry === "_middleware.js") continue;
    const name = entry.slice(0, -3);
    const parts = name === "index" ? segments : [...segments, name];
    const pattern = new RegExp(`^/${parts.map((part) => part.replace(/^\[(\w+)\]$/, "(?<$1>[^/]+)")).join("/")}$`);
    routes.push({ pattern, file: full, params: parts.filter((part) => part.startsWith("[")) });
  }
}
walk(join(root, "functions"));

const middleware = await import(pathToFileURL(join(root, "functions", "_middleware.js")).href);

function handlerFor(module, method) {
  const named = module[`onRequest${method[0]}${method.slice(1).toLowerCase()}`];
  return named || module.onRequest || null;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function staticResponse(pathname) {
  const target = pathname === "/" ? "/index.html" : pathname;
  const file = join(root, "public", target.replace(/\.\./g, ""));
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  return new Response(readFileSync(file), {
    headers: { "Content-Type": MIME[extname(file)] || "application/octet-stream" },
  });
}

async function dispatch(request) {
  const url = new URL(request.url);

  for (const route of routes) {
    const match = url.pathname.match(route.pattern);
    if (!match) continue;
    const module = await import(pathToFileURL(route.file).href);
    const handler = handlerFor(module, request.method);
    if (!handler) continue;
    const params = {};
    for (const key of Object.keys(match.groups || {})) params[key] = match.groups[key];
    const result = await handler({ request, env, params, next: () => staticResponse(url.pathname) });
    if (result) return result;
  }

  const asset = staticResponse(url.pathname);
  if (asset) return asset;
  return new Response("Not Found", { status: 404 });
}

createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
  });

  try {
    const response = await middleware.onRequest({ request, env, params: {}, next: () => dispatch(request) });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: error.message }));
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Servidor local em http://127.0.0.1:${port} (DB ${process.env.DB_FILE || "em memória"})`);
});
