// Servidor de teste local: roda as Functions reais com um D1 simulado (node:sqlite).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROOT = process.env.PROJ || path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const db = new DatabaseSync(":memory:");
db.exec(fs.readFileSync(path.join(ROOT, "migrations", "0001_init.sql"), "utf8"));
db.exec(fs.readFileSync(path.join(ROOT, "migrations", "0002_game.sql"), "utf8"));

class Stmt {
  constructor(sql) { this.sql = sql; this.params = []; }
  bind(...p) { this.params = p; return this; }
  async run() { const r = db.prepare(this.sql).run(...this.params); return { success: true, meta: { changes: Number(r.changes) } }; }
  async first() { return db.prepare(this.sql).get(...this.params) ?? null; }
  async all() { return { results: db.prepare(this.sql).all(...this.params).map((r) => ({ ...r })) }; }
}
export const DB = { prepare: (sql) => new Stmt(sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; } };
export const env = { DB, DISCORD_CLIENT_ID: "test", DISCORD_CLIENT_SECRET: "segredo-de-teste" };
export { db };

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };

export function start(port) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname === "/__peek") {
      const rows = db.prepare("SELECT card_id, pair_key FROM game_cards WHERE game_id = ?").all(url.searchParams.get("gameId"));
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(rows));
    }
    if (url.pathname.startsWith("/api/")) {
      const file = path.join(ROOT, "functions", url.pathname + ".js");
      if (!fs.existsSync(file)) { res.statusCode = 404; return res.end("{}"); }
      const mod = await import(file + "?t=" + Date.now());
      const handler = mod["onRequest" + req.method[0] + req.method.slice(1).toLowerCase()] || mod.onRequest;
      if (!handler) { res.statusCode = 405; return res.end("{}"); }
      const chunks = []; for await (const c of req) chunks.push(c);
      const request = new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
      const response = await handler({ request, env });
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    let f = path.join(ROOT, "public", url.pathname === "/" ? "index.html" : url.pathname);
    if (!fs.existsSync(f)) { res.statusCode = 404; return res.end("nf"); }
    res.setHeader("Content-Type", MIME[path.extname(f)] || "text/plain");
    res.end(fs.readFileSync(f));
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}
