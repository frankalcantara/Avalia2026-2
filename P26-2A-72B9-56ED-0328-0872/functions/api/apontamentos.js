/**
 * Cloudflare Pages Function — /api/apontamentos
 * GET: Devolve o resumo de horas estimadas vs. reais por etapa.
 * POST: Grava um novo apontamento ('manual' ou 'cronometro') no Cloudflare D1.
 */

function obterUtilizadorSessao(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionMatch = cookieHeader.match(/discord_session=([^;]+)/);
  if (!sessionMatch) return null;

  try {
    return JSON.parse(decodeURIComponent(atob(sessionMatch[1])));
  } catch {
    return null;
  }
}

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.DB) {
    return Response.json({ ok: false, error: "Base de dados D1 não configurada." }, { status: 500 });
  }

  try {
    const resumoQuery = await env.DB.prepare(`
      SELECT 
        e.fase,
        e.horas_estimadas,
        COALESCE(SUM(a.horas_gastas), 0) AS horas_reais
      FROM estimativas e
      LEFT JOIN apontamentos a ON e.fase = a.fase
      GROUP BY e.fase, e.horas_estimadas
      ORDER BY CASE e.fase
        WHEN 'Requisitos' THEN 1
        WHEN 'Arquitetura' THEN 2
        WHEN 'Codificacao' THEN 3
        WHEN 'Testes' THEN 4
        ELSE 5
      END
    `).all();

    const recentesQuery = await env.DB.prepare(`
      SELECT id, discord_user_name, fase, horas_gastas, tipo_registro, data_registro
      FROM apontamentos
      ORDER BY id DESC
      LIMIT 10
    `).all();

    return Response.json({
      ok: true,
      resumo: resumoQuery.results || [],
      recentes: recentesQuery.results || [],
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return Response.json({ ok: false, error: "Base de dados D1 não configurada." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionUser = obterUtilizadorSessao(request);

  const discordUserId = sessionUser?.userId || body.discord_user_id;
  const discordUserName = sessionUser?.username || body.discord_user_name;

  if (!discordUserId || !discordUserName) {
    return Response.json(
      { ok: false, error: "Inicia sessão com o Discord antes de registar horas." },
      { status: 401 }
    );
  }

  const fasesValidas = ["Requisitos", "Arquitetura", "Codificacao", "Testes"];
  const fase = String(body.fase || "").trim();
  const horasGastas = Number(body.horas_gastas);
  const tipoRegistro = body.tipo_registro === "cronometro" ? "cronometro" : "manual";

  if (!fasesValidas.includes(fase)) {
    return Response.json({ ok: false, error: "Etapa do ciclo de vida inválida." }, { status: 400 });
  }

  if (!Number.isFinite(horasGastas) || horasGastas <= 0) {
    return Response.json({ ok: false, error: "O valor de horas deve ser maior que zero." }, { status: 400 });
  }

  try {
    await env.DB.prepare(`
      INSERT INTO apontamentos (discord_user_id, discord_user_name, fase, horas_gastas, tipo_registro)
      VALUES (?, ?, ?, ?, ?)
    `)
      .bind(String(discordUserId), String(discordUserName), fase, horasGastas, tipoRegistro)
      .run();

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}