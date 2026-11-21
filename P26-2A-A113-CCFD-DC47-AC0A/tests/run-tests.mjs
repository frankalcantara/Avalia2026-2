// Agente de Teste e Validação — roda com: node tests/run-tests.mjs
// Executa as Pages Functions reais contra um D1 simulado (node:sqlite, exige Node 22.13+).
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHAVE = "P26-2A-A113-CCFD-DC47-AC0A";
let passed = 0, failed = 0;
const check = (name, cond) => {
  if (cond) { passed++; console.log("  ok   " + name); }
  else { failed++; console.log("  FAIL " + name); }
};

// ---------- D1 simulado ----------
function makeDB() {
  const db = new DatabaseSync(":memory:");
  for (const f of ["0001_init.sql", "0002_game.sql"]) db.exec(readFileSync(join(root, "migrations", f), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => ({ success: true, meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
    _sync: () => db.prepare(sql).run(...args),
  });
  return {
    raw: db,
    prepare: (sql) => stmt(sql),
    batch: async (list) => {
      db.exec("BEGIN");
      try { const out = list.map((s) => s._sync()); db.exec("COMMIT"); return out; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
    },
  };
}

const util = await import(join(root, "functions/_lib/util.js"));
const start = await import(join(root, "functions/api/game/start.js"));
const pick = await import(join(root, "functions/api/game/pick.js"));
const board = await import(join(root, "functions/api/game/leaderboard.js"));
const me = await import(join(root, "functions/api/me.js"));

const env = { DB: makeDB(), SESSION_SECRET: "x".repeat(40) };
const exp = Math.floor(Date.now() / 1000) + 3600;
const cookieFor = async (userId, secret = env.SESSION_SECRET) =>
  "discord_session=" + (await util.signSession({ userId, username: "Teste " + userId, avatar: "https://cdn.discordapp.com/embed/avatars/0.png", exp }, secret));

const call = (handler, path, { method = "POST", cookie, body, headers = {} } = {}) =>
  handler({
    env,
    request: new Request("http://localhost" + path, {
      method,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    }),
  });
const j = async (res) => ({ status: res.status, data: await res.json() });

console.log("\n[Autenticação]");
check("start sem cookie -> 401", (await call(start.onRequestPost, "/api/game/start")).status === 401);
const legacy = "discord_session=" + btoa(encodeURIComponent(JSON.stringify({ userId: "999", username: "x", avatar: "" })));
check("cookie forjado (sem assinatura) -> 401", (await call(start.onRequestPost, "/api/game/start", { cookie: legacy })).status === 401);
const evil = await cookieFor("999", "outro-segredo-qualquer-0000000000000000");
check("cookie assinado com outro segredo -> 401", (await call(start.onRequestPost, "/api/game/start", { cookie: evil })).status === 401);
const expired = "discord_session=" + (await util.signSession({ userId: "1", username: "a", avatar: "", exp: 10 }, env.SESSION_SECRET));
check("cookie expirado -> 401", (await call(start.onRequestPost, "/api/game/start", { cookie: expired })).status === 401);
const A = await cookieFor("111");
check("origem diferente -> 403", (await call(start.onRequestPost, "/api/game/start", { cookie: A, headers: { Origin: "https://evil.example" } })).status === 403);
check("/api/me devolve usuário da sessão", (await j(await call(me.onRequestGet, "/api/me", { method: "GET", cookie: A }))).data.user?.userId === "111");

console.log("\n[Início da partida]");
const s = await j(await call(start.onRequestPost, "/api/game/start", { cookie: A }));
check("start -> 200 com 16 cartas", s.status === 200 && s.data.cards.length === 16);
check("cartas têm só o campo token (nada de face/par)", s.data.cards.every((c) => Object.keys(c).join() === "token"));
const gameId = s.data.gameId;
const rows = env.DB.raw.prepare("SELECT token, pair_id, kind, text FROM game_cards WHERE game_id = ?").all(gameId);
const wire = JSON.stringify(s.data);
check("resposta não vaza o texto de nenhuma carta", rows.every((r) => !wire.includes(JSON.stringify(r.text))));
const byPair = {};
for (const r of rows) (byPair[r.pair_id] ||= []).push(r.token);
check("8 pares com 2 cartas cada", Object.keys(byPair).length === 8 && Object.values(byPair).every((p) => p.length === 2));

console.log("\n[Regras no servidor]");
const B = await cookieFor("222");
check("outro usuário não joga a partida alheia -> 404", (await call(pick.onRequestPost, "/api/game/pick", { cookie: B, body: { gameId, token: rows[0].token } })).status === 404);
check("token inexistente -> 404", (await call(pick.onRequestPost, "/api/game/pick", { cookie: A, body: { gameId, token: "c_naoexiste" } })).status === 404);
check("payload inválido -> 400", (await call(pick.onRequestPost, "/api/game/pick", { cookie: A, body: { gameId: 5 } })).status === 400);

const p = Object.values(byPair);
const pk = async (token) => j(await call(pick.onRequestPost, "/api/game/pick", { cookie: A, body: { gameId, token } }));

let r = await pk(p[0][0]);
check("1ª carta -> state first com face revelada", r.status === 200 && r.data.state === "first" && r.data.card.text);
check("mesma carta duas vezes -> 409", (await pk(p[0][0])).status === 409);
r = await pk(p[1][0]);
check("par errado -> match false e moves 1", r.data.match === false && r.data.moves === 1);
check("moves gravado no D1", env.DB.raw.prepare("SELECT moves FROM games WHERE id = ?").get(gameId).moves === 1);

for (let i = 0; i < 8; i++) {
  await pk(p[i][0]);
  r = await pk(p[i][1]);
  check(`par ${i + 1} correto`, r.data.match === true);
}
check("partida finalizada", r.data.finished === true);
check("eficiência = 8/9 = 88.9%", r.data.efficiency === 88.9 && r.data.moves === 9);
const g = env.DB.raw.prepare("SELECT status, moves, efficiency FROM games WHERE id = ?").get(gameId);
check("D1: status finished, moves 9, eficiência 88.9", g.status === "finished" && g.moves === 9 && g.efficiency === 88.9);
check("carta já combinada -> 409", (await pk(p[0][0])).status === 409);

const lb = await j(await call(board.onRequestGet, "/api/game/leaderboard", { method: "GET", cookie: A }));
check("ranking lista a partida", lb.data.entries.length === 1 && lb.data.entries[0].efficiency === 88.9);
check("ranking exige login", (await call(board.onRequestGet, "/api/game/leaderboard", { method: "GET" })).status === 401);

const s2 = await j(await call(start.onRequestPost, "/api/game/start", { cookie: A }));
const s3 = await j(await call(start.onRequestPost, "/api/game/start", { cookie: A }));
check("nova partida abandona a anterior", env.DB.raw.prepare("SELECT status FROM games WHERE id = ?").get(s2.data.gameId).status === "abandoned");
check("ordem dos tokens é diferente a cada partida", s2.data.cards.map((c) => c.token).join() !== s3.data.cards.map((c) => c.token).join());

console.log("\n[Conformidade da rubrica]");
const read = (f) => readFileSync(join(root, f), "utf8");
check("rodapé da interface contém a chave", /<footer[\s\S]*P26-2A-A113-CCFD-DC47-AC0A[\s\S]*<\/footer>/.test(read("public/index.html")));
check("README contém a chave", read("README.md").includes(CHAVE));
check("LICENSE é MIT", /MIT License/i.test(read("LICENSE")));
check("sem frameworks de UI no front", !/react|vue|angular|svelte|jquery/i.test(read("public/app.js") + read("public/index.html")));
check("CSS 3D presente (rotateY + preserve-3d)", /rotateY\(180deg\)/.test(read("public/styles.css")) && /preserve-3d/.test(read("public/styles.css")));
check("3 skills existem", ["serverless-d1-discord", "vanilla-dom-ui", "teste-validacao"].every((n) => existsSync(join(root, "skills", n, "SKILL.md"))));
check("AGENTS.md cita os 3 agentes", (read("AGENTS.md").match(/### Agente \d/g) || []).length >= 3);
check("wrangler.jsonc sem database_id de exemplo", !/0{8}-0{4}/.test(read("wrangler.jsonc")));
check("segredos fora do repositório (.dev.vars ignorado)", read(".gitignore").includes(".dev.vars"));

console.log(`\n${passed} passaram, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
