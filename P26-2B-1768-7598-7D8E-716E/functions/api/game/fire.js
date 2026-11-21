import { json, getUser, shoot, allSunk } from "../../_lib/util.js";
export async function onRequestPost({ request, env }) {
  const u = await getUser(request, env);
  if (!u) return json({ erro: "Não autenticado" }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ erro: "JSON inválido" }, 400); }
  const { gameId, r, c } = body;
  if (![r, c].every((n) => Number.isInteger(n) && n >= 0 && n <= 9)) return json({ erro: "Coordenada inválida" }, 400);
  const g = await env.DB.prepare("SELECT * FROM games WHERE id = ? AND discord_id = ?").bind(String(gameId), u.discord_id).first();
  if (!g) return json({ erro: "Partida não encontrada" }, 404);
  if (g.status !== "playing") return json({ erro: "Partida não está em andamento" }, 409);

  const pf = JSON.parse(g.player_fleet), ef = JSON.parse(g.enemy_fleet);
  const ps = JSON.parse(g.player_shots), es = JSON.parse(g.enemy_shots);
  if (ps.some(([a, b]) => a === r && b === c)) return json({ erro: "Você já atacou essa célula" }, 409);

  const mine = shoot(ef, ps, r, c);
  ps.push([r, c]);
  let over = false, winner = null, enemy = null, status = "playing";
  if (allSunk(ef, ps)) { over = true; winner = "player"; status = "won"; }
  else {
    const free = [];
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) if (!es.some(([a, b]) => a === i && b === j)) free.push([i, j]);
    const [er, ec] = free[Math.floor(Math.random() * free.length)];
    enemy = { r: er, c: ec, ...shoot(pf, es, er, ec) };
    es.push([er, ec]);
    if (allSunk(pf, es)) { over = true; winner = "enemy"; status = "lost"; }
  }
  const stmts = [env.DB.prepare("UPDATE games SET status = ?, player_shots = ?, enemy_shots = ? WHERE id = ?").bind(status, JSON.stringify(ps), JSON.stringify(es), g.id)];
  if (over) stmts.push(env.DB.prepare(`UPDATE users SET ${winner === "player" ? "wins = wins + 1" : "losses = losses + 1"} WHERE discord_id = ?`).bind(u.discord_id));
  await env.DB.batch(stmts);
  return json({ r, c, ...mine, enemy, over, winner, ...(over ? { enemyFleet: ef } : {}) });
}
