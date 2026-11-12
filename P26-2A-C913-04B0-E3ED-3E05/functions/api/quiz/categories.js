const LIST_CATEGORIES_SQL = `
  SELECT
    quiz_category.id,
    quiz_category.name,
    COUNT(quiz_question.id) AS questionCount
  FROM quiz_categories AS quiz_category
  LEFT JOIN quiz_questions AS quiz_question
    ON quiz_question.category_id = quiz_category.id
  GROUP BY quiz_category.id, quiz_category.name
  ORDER BY quiz_category.name
`;

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return Response.json(
      { ok: false, error: "database_unavailable" },
      { status: 503 },
    );
  }

  const result = await env.DB.prepare(LIST_CATEGORIES_SQL).all();
  const categories = (result.results || []).map((category) => ({
    ...category,
    questionCount: Number(category.questionCount),
  }));

  return Response.json(
    { categories },
    { headers: { "Cache-Control": "no-store" } },
  );
}
