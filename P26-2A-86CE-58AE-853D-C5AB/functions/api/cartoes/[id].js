import { jsonError, readJsonObject, validateCardPayload } from "../_utils.js";

const CARD_SELECT = "SELECT id, user_id, titulo, descricao, prioridade, coluna, posicao, criado_em, atualizado_em FROM cartoes";

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function onRequestPatch(context) {
  const { request, env, data, params } = context;
  const id = parseId(params.id);
  if (id === null) {
    return jsonError("ID de cartão inválido.", 400);
  }

  const parsed = await readJsonObject(request);
  if (parsed.error) {
    return jsonError(parsed.error, 400);
  }

  const validated = validateCardPayload(parsed.body, true);
  if (validated.error) {
    return jsonError(validated.error, 400);
  }

  const userId = data.usuario.user_id;
  try {
    const existing = await env.DB.prepare(
      `${CARD_SELECT} WHERE id = ? AND user_id = ?`
    ).bind(id, userId).first();
    if (!existing) {
      return jsonError("Cartão não encontrado.", 404);
    }

    const entries = Object.entries(validated.values);
    const assignments = entries.map(([column]) => `${column} = ?`);
    assignments.push("atualizado_em = CURRENT_TIMESTAMP");
    const values = entries.map(([, value]) => value);

    await env.DB.prepare(
      `UPDATE cartoes SET ${assignments.join(", ")} WHERE id = ? AND user_id = ?`
    ).bind(...values, id, userId).run();

    const cartao = await env.DB.prepare(
      `${CARD_SELECT} WHERE id = ? AND user_id = ?`
    ).bind(id, userId).first();
    if (!cartao) {
      return jsonError("Cartão não encontrado.", 404);
    }

    return Response.json(cartao);
  } catch (error) {
    console.error("Card update failed.");
    return jsonError("Falha ao atualizar cartão.", 500);
  }
}

export async function onRequestDelete(context) {
  const { env, data, params } = context;
  const id = parseId(params.id);
  if (id === null) {
    return jsonError("ID de cartão inválido.", 400);
  }

  try {
    const result = await env.DB.prepare(
      "DELETE FROM cartoes WHERE id = ? AND user_id = ?"
    ).bind(id, data.usuario.user_id).run();
    if (!result.meta.changes) {
      return jsonError("Cartão não encontrado.", 404);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Card deletion failed.");
    return jsonError("Falha ao excluir cartão.", 500);
  }
}
