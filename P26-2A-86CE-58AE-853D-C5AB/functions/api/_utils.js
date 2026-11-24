const PRIORIDADES = ["baixa", "media", "alta"];
const COLUNAS = ["a_fazer", "em_execucao", "concluido"];

export function jsonError(error, status) {
  return Response.json({ error }, { status });
}

export async function readJsonObject(request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { body: null, error: "O corpo deve ser um objeto JSON." };
    }
    return { body, error: null };
  } catch (error) {
    return { body: null, error: "Corpo JSON inválido." };
  }
}

export function validateCardPayload(body, partial) {
  const values = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  if (!partial && !has("titulo")) {
    return { error: "Título obrigatório." };
  }

  if (has("titulo")) {
    if (typeof body.titulo !== "string") {
      return { error: "Título inválido." };
    }
    const titulo = body.titulo.trim();
    if (titulo.length < 1 || titulo.length > 120) {
      return { error: "O título deve ter entre 1 e 120 caracteres." };
    }
    values.titulo = titulo;
  }

  if (has("descricao")) {
    if (typeof body.descricao !== "string" || body.descricao.length > 1000) {
      return { error: "A descrição deve ter até 1000 caracteres." };
    }
    values.descricao = body.descricao;
  }

  if (has("prioridade")) {
    if (typeof body.prioridade !== "string" || !PRIORIDADES.includes(body.prioridade)) {
      return { error: "Prioridade inválida." };
    }
    values.prioridade = body.prioridade;
  } else if (!partial) {
    values.prioridade = "media";
  }

  if (partial && has("coluna")) {
    if (typeof body.coluna !== "string" || !COLUNAS.includes(body.coluna)) {
      return { error: "Coluna inválida." };
    }
    values.coluna = body.coluna;
  }

  if (partial && has("posicao")) {
    if (typeof body.posicao !== "number" || !Number.isFinite(body.posicao)) {
      return { error: "Posição inválida." };
    }
    values.posicao = body.posicao;
  }

  if (partial && Object.keys(values).length === 0) {
    return { error: "Nenhum campo de cartão válido informado." };
  }

  return { values, error: null };
}
