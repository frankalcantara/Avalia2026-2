export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT user_id, username, avatar FROM discord_users ORDER BY username COLLATE NOCASE"
  ).all();
  return Response.json({ users: results }, { headers: { "Cache-Control": "no-store" } });
}
