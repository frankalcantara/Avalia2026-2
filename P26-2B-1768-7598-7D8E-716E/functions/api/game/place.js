import { json, getUser, validFleet, randomFleet } from "../../_lib/util.js";
export async function onRequestPost({ request, env }) {
  const u = await getUser(request, env);
  if (!u) return json({ erro: "Não autenticado" }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ erro: "JSON inválido" }, 400); }
  const g = await env.DB.prepare("SELECT status FROM games WHERE id = ? AND discord_id = ?").bind(String(body.gameId), u.discord_id).first();
  if (!g) return json({ erro: "Partida não encontrada" }, 404);
  if (g.status !== "placing") return json({ erro: "A frota já foi posicionada" }, 409);
  if (!validFleet(body.ships)) return json({ erro: "Frota inválida: use os 5 navios, dentro da malha 10x10 e sem sobreposição" }, 400);
  const ships = body.ships.map(({ name, r, c, o }) => ({ name, r, c, o }));
  await env.DB.prepare("UPDATE games SET status = 'playing', player_fleet = ?, enemy_fleet = ? WHERE id = ?")
    .bind(JSON.stringify(ships), JSON.stringify(randomFleet()), String(body.gameId)).run();
  return json({ ok: true });
}
