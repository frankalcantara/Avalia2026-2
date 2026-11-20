import { jsonError, readJsonObject, validateCardPayload } from "../_utils.js";

export async function onRequestGet(context) {
  const { env, data } = context;
  try {
    const result = await env.DB.prepare(
      "SELECT id, user_id, titulo, descricao, prioridade, coluna, posicao, criado_em, atualizado_em FROM cartoes WHERE user_id = ? ORDER BY coluna, posicao"
    ).bind(data.usuario.user_id).all();
    return Response.json(result.results || []);
  } catch (error) {
    console.error("Card listing failed.");
    return jsonError("Falha ao listar cartões.", 500);
  }
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const parsed = await readJsonObject(request);
  if (parsed.error) {
    return jsonError(parsed.error, 400);
  }

  const validated = validateCardPayload(parsed.body, false);
  if (validated.error) {
    return jsonError(validated.error, 400);
  }

  try {
    const { titulo, descricao = "", prioridade } = validated.values;
    const userId = data.usuario.user_id;
    const positionRow = await env.DB.prepare(
      "SELECT COALESCE(MAX(posicao), 0) + 1 AS proxima_posicao FROM cartoes WHERE user_id = ? AND coluna = ?"
    ).bind(userId, "a_fazer").first();

    const insertResult = await env.DB.prepare(
      "INSERT INTO cartoes (user_id, titulo, descricao, prioridade, coluna, posicao) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId, titulo, descricao, prioridade, "a_fazer", positionRow.proxima_posicao).run();

    const cartao = await env.DB.prepare(
      "SELECT id, user_id, titulo, descricao, prioridade, coluna, posicao, criado_em, atualizado_em FROM cartoes WHERE id = ? AND user_id = ?"
    ).bind(insertResult.meta.last_row_id, userId).first();

    if (!cartao) {
      console.error("Inserted card could not be read.");
      return jsonError("Falha ao criar cartão.", 500);
    }

    return Response.json(cartao, { status: 201 });
  } catch (error) {
    console.error("Card creation failed.");
    return jsonError("Falha ao criar cartão.", 500);
  }
}
