function getUser(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(atob(match[1])));
  } catch {
    return null;
  }
}

export async function onRequestGet({ request, env }) {
  const user = getUser(request);

  const { results } = await env.DB.prepare(`
    SELECT 
      e.*,
      u.nome AS criador_nome,
      (SELECT COUNT(*) FROM inscricoes i WHERE i.evento_id = e.id AND i.status = 'confirmado') AS confirmados_count,
      (SELECT COUNT(*) FROM inscricoes i WHERE i.evento_id = e.id AND i.status = 'espera') AS espera_count
    FROM eventos e
    JOIN usuarios u ON e.criador_id = u.id
    ORDER BY e.data ASC, e.horario ASC
  `).all();

  let minhasInscricoes = {};
  if (user) {
    const insc = await env.DB.prepare(
      "SELECT evento_id, status FROM inscricoes WHERE usuario_id = ?1 AND status != 'cancelado'"
    )
      .bind(user.id)
      .all();
    for (const row of insc.results) {
      minhasInscricoes[row.evento_id] = row.status;
    }
  }

  const eventosFormatados = results.map((ev) => ({
    ...ev,
    meu_status: minhasInscricoes[ev.id] || null
  }));

  return Response.json(eventosFormatados);
}

export async function onRequestPost({ request, env }) {
  const user = getUser(request);
  if (!user) {
    return Response.json({ error: "Faça login com o Discord para criar eventos." }, { status: 401 });
  }

  const body = await request.json();
  const { titulo, local, data, horario, capacidade_maxima } = body;

  if (!titulo || !local || !data || !horario || !capacidade_maxima || capacidade_maxima < 1) {
    return Response.json({ error: "Preencha todos os campos corretamente." }, { status: 400 });
  }

  const res = await env.DB.prepare(`
    INSERT INTO eventos (criador_id, titulo, local, data, horario, capacidade_maxima)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
  `)
    .bind(user.id, titulo, local, data, horario, Number(capacidade_maxima))
    .run();

  return Response.json({ ok: true, id: res.meta.last_row_id }, { status: 201 });
}