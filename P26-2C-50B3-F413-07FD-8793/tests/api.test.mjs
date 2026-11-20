import assert from "node:assert/strict";
import { start, env, db } from "./harness.mjs";
import { createSessionCookie } from "../functions/_lib/session.js";

const PORT = 8791, B = `http://localhost:${PORT}`;
const server = await start(PORT);
const cookieOf = async (u) => (await createSessionCookie(u, env)).split(";")[0];
const call = (p, { method = "GET", body, cookie } = {}) =>
  fetch(B + p, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });

const ana = await cookieOf({ userId: "111", username: "Ana", avatar: "" });
const bob = await cookieOf({ userId: "222", username: "Bob", avatar: "" });
db.prepare("INSERT INTO discord_users (user_id, username, avatar) VALUES ('111','Ana','')").run();

// 1) sem sessão e cookie forjado
assert.equal((await call("/api/game/start", { method: "POST" })).status, 401);
const forged = ana.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
assert.equal((await call("/api/me", { cookie: forged })).status, 401);
const legacy = "discord_session=" + btoa(encodeURIComponent(JSON.stringify({ userId: "999", username: "x" })));
assert.equal((await call("/api/me", { cookie: legacy })).status, 401);
assert.equal((await call("/api/me", { cookie: ana })).status, 200);

// 2) start: só IDs opacos
const start1 = await (await call("/api/game/start", { method: "POST", cookie: ana })).json();
assert.equal(start1.cards.length, 16);
assert.deepEqual(Object.keys(start1).sort(), ["cards", "gameId", "moves", "ok", "totalPairs"]);
assert.equal(new Set(start1.cards).size, 16);
const peek = () => Object.fromEntries(db.prepare("SELECT card_id, pair_key FROM game_cards WHERE game_id=?").all(start1.gameId).map((r) => [r.card_id, r.pair_key]));
const keys = peek();
const flip = (id, cookie = ana) => call("/api/game/flip", { method: "POST", cookie, body: { gameId: start1.gameId, cardId: id } });
const check = (a, b, cookie = ana) => call("/api/game/check", { method: "POST", cookie, body: { gameId: start1.gameId, cardA: a, cardB: b } });

// 3) regras: check sem virar, 3ª carta, jogo de outro usuário
const [c0, c1, c2] = start1.cards;
assert.equal((await check(c0, c1)).status, 409);
assert.equal((await flip(c0, bob)).status, 404);
assert.equal((await flip(c0)).status, 200);
assert.equal((await flip(c1)).status, 200);
assert.equal((await flip(c2)).status, 409, "3ª carta deve ser recusada");
assert.equal((await check(c0, c0)).status, 400);
assert.equal((await check(c0, c1, bob)).status, 404);

// 4) joga: primeiro um erro proposital, depois todos os pares
const byPair = {};
for (const [id, k] of Object.entries(keys)) (byPair[k] ??= []).push(id);
const pairs = Object.values(byPair);
let moves = 0, last;
// resolve o par aberto (c0,c1)
let r = await (await check(c0, c1)).json(); moves++;
assert.equal(r.match, keys[c0] === keys[c1]); assert.equal(r.moves, 1);
// erro proposital entre pares diferentes ainda não resolvidos
const open = pairs.filter((p) => !(r.match && p.includes(c0)));
const [x, y] = [open[0][0], open[1][0]];
await flip(x); await flip(y);
r = await (await check(x, y)).json(); moves++;
assert.equal(r.match, false); assert.equal(r.moves, moves);
// agora acerta todos os pares restantes
for (const p of pairs) {
  const row = db.prepare("SELECT matched FROM game_cards WHERE game_id=? AND card_id=?").get(start1.gameId, p[0]);
  if (row.matched) continue;
  assert.equal((await flip(p[0])).status, 200);
  assert.equal((await flip(p[1])).status, 200);
  last = await (await check(p[0], p[1])).json(); moves++;
  assert.equal(last.match, true);
}
assert.equal(last.finished, true);
assert.equal(last.moves, moves);
assert.equal(last.efficiency, Math.round((8 / moves) * 1000) / 10);
const g = db.prepare("SELECT * FROM games WHERE id=?").get(start1.gameId);
assert.equal(g.status, "finished"); assert.equal(g.moves, moves); assert.ok(g.finished_at);
// carta já combinada e partida encerrada
assert.equal((await flip(pairs[0][0])).status, 409);

// 5) nova partida abandona a ativa; ranking
const s2 = await (await call("/api/game/start", { method: "POST", cookie: ana })).json();
const s3 = await (await call("/api/game/start", { method: "POST", cookie: ana })).json();
assert.equal(db.prepare("SELECT status FROM games WHERE id=?").get(s2.gameId).status, "abandoned");
const rank = await (await call("/api/ranking", { cookie: ana })).json();
assert.equal(rank.ranking.length, 1); assert.equal(rank.ranking[0].username, "Ana");
assert.equal((await call("/api/ranking")).status, 401);
// logout limpa cookie
const lo = await call("/api/auth/logout", { method: "POST" });
assert.match(lo.headers.get("set-cookie"), /Max-Age=0/);
const st = await (await call("/api/status", { cookie: ana })).json();
assert.equal(st.d1Connected, true); assert.equal(st.sessionUser.userId, "111");

console.log("API OK — partida de teste: %d movimentos, eficiência %s%%", moves, last.efficiency);
server.close();
