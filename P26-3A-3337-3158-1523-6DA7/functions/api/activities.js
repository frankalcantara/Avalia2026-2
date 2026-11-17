import {
  json,
  getSessionUser,
  ensureSchema,
  upsertDiscordUser,
  normalizeCategory,
  parseHours,
  isValidUrl,
  isSameOrigin,
  CAP_PER_CATEGORY,
  HOURS_EPSILON,
} from "../_utils.js";

/**
 * /api/activities
 *  GET    -> lista as atividades do usuario autenticado
 *  POST   -> registra atividade (valida categoria, horas, URL e teto por categoria NO SERVIDOR)
 *  DELETE -> remove uma atividade do proprio usuario (?id=)
 */
export async function onRequest(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);

  if (!user) {
    return json({ ok: false, error: "Autenticação via Discord obrigatória." }, 401);
  }
  if (!env.DB) {
    return json({ ok: false, error: "Banco D1 não disponível." }, 503);
  }
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return json({ ok: false, error: "Origem não permitida." }, 403);
  }

  await ensureSchema(env);

  if (request.method === "GET") {
    const res = await env.DB.prepare(
      "SELECT id, category, title, hours, certificate_url, created_at FROM activities WHERE user_id = ? ORDER BY id DESC"
    )
      .bind(user.userId)
      .all();
    return json({ ok: true, activities: res.results || [] });
  }

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "JSON inválido." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ ok: false, error: "JSON inválido." }, 400);
    }

    const category = normalizeCategory(body.category);
    const title = String(body.title ?? "").trim().slice(0, 200);
    const hours = parseHours(body.hours);
    const certificateUrl = String(body.certificateUrl ?? body.certificate_url ?? "")
      .trim()
      .slice(0, 2000);

    if (!category) {
      return json({ ok: false, error: "Categoria inválida. Use ensino, pesquisa ou extensão." }, 400);
    }
    if (!title) {
      return json({ ok: false, error: "Título/descrição da atividade é obrigatório." }, 400);
    }
    if (hours === null) {
      return json({ ok: false, error: "Carga horária deve ser um número positivo (até 2 casas decimais)." }, 400);
    }
    if (!certificateUrl || !isValidUrl(certificateUrl)) {
      return json({ ok: false, error: "Link do certificado digital inválido (URL http/https)." }, 400);
    }

    await upsertDiscordUser(env, user);

    // Regra de teto por categoria aplicada de forma ATOMICA: um unico INSERT ... SELECT
    // so grava se (horas ja registradas + novas) <= teto. Evita corrida entre requisicoes.
    const insert = await env.DB.prepare(
      `INSERT INTO activities (user_id, username, category, title, hours, certificate_url)
       SELECT ?, ?, ?, ?, ?, ?
       WHERE (SELECT COALESCE(SUM(hours), 0) FROM activities WHERE user_id = ? AND category = ?) + ? <= ?`
    )
      .bind(
        user.userId,
        user.username,
        category,
        title,
        hours,
        certificateUrl,
        user.userId,
        category,
        hours,
        CAP_PER_CATEGORY + HOURS_EPSILON
      )
      .run();

    if (!insert.meta || insert.meta.changes === 0) {
      const sumRow = await env.DB.prepare(
        "SELECT COALESCE(SUM(hours), 0) AS total FROM activities WHERE user_id = ? AND category = ?"
      )
        .bind(user.userId, category)
        .first();
      const available = Math.max(0, CAP_PER_CATEGORY - Number(sumRow?.total || 0));
      return json(
        {
          ok: false,
          error: `Teto de ${CAP_PER_CATEGORY}h por categoria excedido em ${category}. Horas disponíveis: ${available.toFixed(2)}h.`,
          available,
        },
        409
      );
    }

    return json({ ok: true, message: "Atividade registrada e validada com sucesso." }, 201);
  }

  if (request.method === "DELETE") {
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !/^\d{1,15}$/.test(id)) {
      return json({ ok: false, error: "Parâmetro id inválido." }, 400);
    }
    const del = await env.DB.prepare("DELETE FROM activities WHERE id = ? AND user_id = ?")
      .bind(Number(id), user.userId)
      .run();
    if (!del.meta || del.meta.changes === 0) {
      return json({ ok: false, error: "Atividade não encontrada." }, 404);
    }
    return json({ ok: true });
  }

  return json({ ok: false, error: "Method not allowed" }, 405);
}
