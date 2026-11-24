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

export async function onRequestPost({ request, env }) {
  const user = getUser(request);
  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { evento_id, acao } = await request.json();
  if (!evento_id || !acao) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const evento = await env.DB.prepare("SELECT * FROM eventos WHERE id = ?1")
    .bind(evento_id)
    .first();

  if (!evento) {
    return Response.json({ error: "Evento não encontrado." }, { status: 404 });
  }

  if (acao === "inscrever") {
    const existente = await env.DB.prepare(
      "SELECT * FROM inscricoes WHERE evento_id = ?1 AND usuario_id = ?2"
    )
      .bind(evento_id, user.id)
      .first();

    if (existente && existente.status !== "cancelado") {
      return Response.json({ error: "Você já está inscrito neste evento." }, { status: 400 });
    }

    const { total } = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM inscricoes WHERE evento_id = ?1 AND status = 'confirmado'"
    )
      .bind(evento_id)
      .first();

    const novoStatus = total < evento.capacidade_maxima ? "confirmado" : "espera";

    if (existente) {
      await env.DB.prepare(
        "UPDATE inscricoes SET status = ?1, data_solicitacao = CURRENT_TIMESTAMP WHERE id = ?2"
      )
        .bind(novoStatus, existente.id)
        .run();
    } else {
      await env.DB.prepare(
        "INSERT INTO inscricoes (evento_id, usuario_id, status) VALUES (?1, ?2, ?3)"
      )
        .bind(evento_id, user.id, novoStatus)
        .run();
    }

    return Response.json({ ok: true, status: novoStatus });
  }

  if (acao === "cancelar") {
    const inscricao = await env.DB.prepare(
      "SELECT * FROM inscricoes WHERE evento_id = ?1 AND usuario_id = ?2 AND status != 'cancelado'"
    )
      .bind(evento_id, user.id)
      .first();

    if (!inscricao) {
      return Response.json({ error: "Inscrição não encontrada." }, { status: 404 });
    }

    await env.DB.prepare("UPDATE inscricoes SET status = 'cancelado' WHERE id = ?1")
      .bind(inscricao.id)
      .run();

    if (inscricao.status === "confirmado") {
      const proximoFila = await env.DB.prepare(
        "SELECT id FROM inscricoes WHERE evento_id = ?1 AND status = 'espera' ORDER BY data_solicitacao ASC, id ASC LIMIT 1"
      )
        .bind(evento_id)
        .first();

      if (proximoFila) {
        await env.DB.prepare("UPDATE inscricoes SET status = 'confirmado' WHERE id = ?1")
          .bind(proximoFila.id)
          .run();
      }
    }

    return Response.json({ ok: true, status: "cancelado" });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}