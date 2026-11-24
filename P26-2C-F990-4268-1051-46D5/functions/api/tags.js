/**
 * Cloudflare Pages Function: GET /api/tags
 * Lists the user's tags with how many notes use each one.
 */
import { getUser, json } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await getUser(env, request);
  if (!user) return json({ error: "Não autenticado." }, 401);

  const { results } = await env.DB.prepare(
    `SELECT t.name AS name, COUNT(nt.note_id) AS total
       FROM tags t
       JOIN note_tags nt ON nt.tag_id = t.id
      WHERE t.user_id = ?1
      GROUP BY t.id
      ORDER BY t.name`
  )
    .bind(user.userId)
    .all();

  return json(results);
}
