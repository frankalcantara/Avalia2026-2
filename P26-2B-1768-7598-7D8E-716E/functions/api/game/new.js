import { json, getUser } from "../../_lib/util.js";
export async function onRequestPost({ request, env }) {
  const u = await getUser(request, env);
  if (!u) return json({ erro: "Não autenticado" }, 401);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO games (id, discord_id, status, created_at) VALUES (?, ?, 'placing', ?)").bind(id, u.discord_id, Date.now()).run();
  return json({ gameId: id });
}
