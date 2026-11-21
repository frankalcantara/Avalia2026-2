import { json } from "../_lib/util.js";
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT discord_id, username, avatar, wins, losses FROM users WHERE wins + losses > 0 ORDER BY wins DESC, losses ASC LIMIT 10").all();
  return json(results);
}
