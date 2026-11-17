import {
  json,
  getSessionUser,
  ensureSchema,
  CATEGORIES,
  CAP_PER_CATEGORY,
  TOTAL_REQUIRED,
} from "../_utils.js";

/** /api/summary — horas por eixo do usuario autenticado e quanto falta para integralizar. */
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ ok: false, error: "Autenticação via Discord obrigatória." }, 401);
  }
  if (!env.DB) {
    return json({ ok: false, error: "Banco D1 não disponível." }, 503);
  }

  await ensureSchema(env);

  const rows = await env.DB.prepare(
    "SELECT category, COALESCE(SUM(hours), 0) AS total, COUNT(*) AS qtd FROM activities WHERE user_id = ? GROUP BY category"
  )
    .bind(user.userId)
    .all();

  const totals = {};
  const counts = {};
  const remaining = {};
  for (const c of CATEGORIES) {
    totals[c] = 0;
    counts[c] = 0;
  }
  for (const r of rows.results || []) {
    if (totals[r.category] !== undefined) {
      totals[r.category] = Number(r.total || 0);
      counts[r.category] = Number(r.qtd || 0);
    }
  }
  for (const c of CATEGORIES) {
    remaining[c] = Math.max(0, CAP_PER_CATEGORY - totals[c]);
  }

  const total = CATEGORIES.reduce((acc, c) => acc + totals[c], 0);

  return json({
    ok: true,
    user,
    totals,
    counts,
    remaining,
    total,
    required: TOTAL_REQUIRED,
    remainingTotal: Math.max(0, TOTAL_REQUIRED - total),
    capPerCategory: CAP_PER_CATEGORY,
  });
}
