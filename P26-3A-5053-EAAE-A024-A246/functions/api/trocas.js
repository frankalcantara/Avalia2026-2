import { getSessionUser, json } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  try {
    if (!env.DB) {
      return json({ ok: false, erro: "Banco de dados indisponível." }, 503);
    }

    const usuario = await getSessionUser(request, env);

    if (!usuario) {
      return json({ ok: false, erro: "Faça login para continuar." }, 401);
    }

    const resultado = await env.DB.prepare(`
      SELECT
        t.id,
        t.livro_alvo_id,
        t.livro_ofertado_id,
        t.proponente_id,
        t.dono_alvo_id,
        t.status,
        t.mensagem,
        t.criada_em,
        t.decidida_em,
        t.concluida_em,
        t.confirmada_proponente_em,
        t.confirmada_dono_em,

        alvo.titulo AS titulo_alvo,
        alvo.autor AS autor_alvo,

        ofertado.titulo AS titulo_ofertado,
        ofertado.autor AS autor_ofertado,

        proponente.username AS proponente_username,
        proponente.global_name AS proponente_global_name,

        dono.username AS dono_username,
        dono.global_name AS dono_global_name

      FROM propostas_troca t

      INNER JOIN livros alvo
        ON alvo.id = t.livro_alvo_id

      INNER JOIN livros ofertado
        ON ofertado.id = t.livro_ofertado_id

      INNER JOIN discord_users proponente
        ON proponente.user_id = t.proponente_id

      INNER JOIN discord_users dono
        ON dono.user_id = t.dono_alvo_id

      WHERE t.proponente_id = ?
         OR t.dono_alvo_id = ?

      ORDER BY t.id DESC
    `).bind(usuario.user_id, usuario.user_id).all();

    return json({
      ok: true,
      trocas: resultado.results || []
    });

  } catch (error) {
    console.error("Erro ao buscar trocas:", error);

    return json({
      ok: false,
      erro: "Não foi possível carregar as propostas de troca."
    }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) {
      return json({ ok: false, erro: "Banco de dados indisponível." }, 503);
    }

    const usuario = await getSessionUser(request, env);

    if (!usuario) {
      return json({ ok: false, erro: "Faça login para continuar." }, 401);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ ok: false, erro: "JSON inválido." }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ ok: false, erro: "Dados inválidos." }, 400);
    }

    const livroAlvoId = Number(body.livro_alvo_id);
    const livroOfertadoId = Number(body.livro_ofertado_id);

    const mensagem =
      typeof body.mensagem === "string"
        ? body.mensagem.trim()
        : "";

    if (
      !Number.isInteger(livroAlvoId) ||
      livroAlvoId <= 0 ||
      !Number.isInteger(livroOfertadoId) ||
      livroOfertadoId <= 0 ||
      livroAlvoId === livroOfertadoId
    ) {
      return json({ ok: false, erro: "Seleção de livros inválida." }, 400);
    }

    if (mensagem.length > 500) {
      return json({
        ok: false,
        erro: "A mensagem deve ter no máximo 500 caracteres."
      }, 400);
    }

    const alvo = await env.DB.prepare(`
      SELECT id, dono_id, titulo, modalidade, status, catalogo_ativo
      FROM livros
      WHERE id = ?
    `).bind(livroAlvoId).first();

    if (!alvo) {
      return json({
        ok: false,
        erro: "O livro desejado não foi encontrado."
      }, 404);
    }

    const ofertado = await env.DB.prepare(`
      SELECT id, dono_id, titulo, modalidade, status, catalogo_ativo
      FROM livros
      WHERE id = ?
    `).bind(livroOfertadoId).first();

    if (!ofertado) {
      return json({
        ok: false,
        erro: "O livro oferecido não foi encontrado."
      }, 404);
    }

    if (alvo.catalogo_ativo !== 1 || ofertado.catalogo_ativo !== 1) {
      return json({
        ok: false,
        erro: "Um dos livros foi retirado do catálogo."
      }, 409);
    }

    if (alvo.dono_id === usuario.user_id) {
      return json({
        ok: false,
        erro: "Você não pode propor uma troca pelo seu próprio livro."
      }, 400);
    }

    if (ofertado.dono_id !== usuario.user_id) {
      return json({
        ok: false,
        erro: "Você só pode oferecer um livro que pertence à sua conta."
      }, 403);
    }

    if (!["Trocar", "Ambos"].includes(alvo.modalidade)) {
      return json({
        ok: false,
        erro: "O livro desejado não está disponível para troca."
      }, 400);
    }

    if (!["Trocar", "Ambos"].includes(ofertado.modalidade)) {
      return json({
        ok: false,
        erro: "O livro oferecido precisa estar marcado como Trocar ou Ambos."
      }, 400);
    }

    if (alvo.status !== "Disponível" || ofertado.status !== "Disponível") {
      return json({
        ok: false,
        erro: "Os dois livros precisam estar disponíveis."
      }, 409);
    }

    // A reserva e a criação da proposta são executadas em um único batch.
    // Se a inserção falhar por uma restrição ou trigger, o batch é revertido.

    const reserva = env.DB.prepare(`
      UPDATE livros
      SET status = 'Reservado'
      WHERE id IN (?, ?)
        AND status = 'Disponível'
        AND catalogo_ativo = 1
        AND (
          SELECT COUNT(*)
          FROM livros
          WHERE id IN (?, ?)
            AND status = 'Disponível'
            AND catalogo_ativo = 1
        ) = 2
    `).bind(
      livroAlvoId,
      livroOfertadoId,
      livroAlvoId,
      livroOfertadoId
    );

    const insercao = env.DB.prepare(`
      INSERT INTO propostas_troca (
        livro_alvo_id,
        livro_ofertado_id,
        proponente_id,
        dono_alvo_id,
        mensagem
      )
      SELECT ?, ?, ?, ?, ?
      WHERE changes() = 2
    `).bind(
      livroAlvoId,
      livroOfertadoId,
      usuario.user_id,
      alvo.dono_id,
      mensagem || null
    );

    const resultados = await env.DB.batch([reserva, insercao]);

    const livrosReservados = resultados[0]?.meta?.changes || 0;
    const propostasCriadas = resultados[1]?.meta?.changes || 0;

    if (livrosReservados !== 2 || propostasCriadas !== 1) {
      return json({
        ok: false,
        erro: "Não foi possível reservar os dois livros. Atualize o catálogo e tente novamente."
      }, 409);
    }

    const trocaId = resultados[1]?.meta?.last_row_id;

    return json({
      ok: true,
      mensagem: "Proposta de troca enviada!",
      troca_id: trocaId
    }, 201);

  } catch (error) {
    console.error("Erro ao criar proposta de troca:", error);

    const detalhe = String(error?.message || "");

    if (
      detalhe.includes("negociação ativa") ||
      detalhe.includes("UNIQUE constraint")
    ) {
      return json({
        ok: false,
        erro: "Um dos livros já possui uma negociação ativa."
      }, 409);
    }

    return json({
      ok: false,
      erro: "Não foi possível enviar a proposta de troca."
    }, 500);
  }
}