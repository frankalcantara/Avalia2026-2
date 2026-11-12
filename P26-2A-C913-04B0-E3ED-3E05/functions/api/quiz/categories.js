export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const result = await env.DB.prepare("SELECT c.id, c.name, COUNT(q.id) AS questionCount FROM quiz_categories c LEFT JOIN quiz_questions q ON q.category_id = c.id GROUP BY c.id, c.name ORDER BY c.name").all();
  return Response.json({ categories: (result.results || []).map(row => ({ ...row, questionCount: Number(row.questionCount) })) }, { headers: { "Cache-Control": "no-store" } });
}
