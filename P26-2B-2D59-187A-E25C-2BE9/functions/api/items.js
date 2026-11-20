import { getSession, json, methodNotAllowed } from "../_shared/auth.js";

export async function onRequest({ request, env }) {
  if (request.method === "GET") return listItems(request, env);
  if (request.method === "POST") return createItem(request, env);
  return methodNotAllowed("GET, POST");
}

async function listItems(request, env) {
  try {
    const user = await getSession(request, env);
    if (!user) return json({ error: "Autenticação necessária." }, 401);
    if (!env.DB) return json({ error: "Banco de dados indisponível." }, 503);

    const result = await env.DB.prepare(
      `SELECT id, name, category, description, unit, quantity, min_quantity,
              responsible_agent
       FROM items
       ORDER BY category COLLATE NOCASE, name COLLATE NOCASE`,
    ).all();
    return json({ items: result.results || [] });
  } catch (error) {
    console.error("Could not load inventory items.", error);
    return json({ error: "Não foi possível carregar os itens." }, 500);
  }
}

async function createItem(request, env) {
  try {
    const user = await getSession(request, env);
    if (!user) return json({ error: "Autenticação necessária." }, 401);
  } catch (error) {
    console.error("Session validation failed for item creation.", error);
    return json({ error: "Autenticação não configurada." }, 500);
  }
  if (!env.DB) return json({ error: "Banco de dados indisponível." }, 503);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) {
    return json({ error: "O corpo deve ser enviado como application/json." }, 400);
  }
  if (Number(request.headers.get("Content-Length") || 0) > 16_384) {
    return json({ error: "Corpo da requisição muito grande." }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "O corpo deve ser um objeto JSON." }, 400);
  }
  const expectedKeys = [
    "category",
    "description",
    "min_quantity",
    "name",
    "quantity",
    "responsible_agent",
    "unit",
  ];
  const keys = Object.keys(body).sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    return json({ error: "Informe os campos necessários do item, sem campos adicionais." }, 400);
  }
  for (const field of ["name", "category", "unit"]) {
    if (typeof body[field] !== "string" || body[field].trim().length < 1 ||
        body[field].trim().length > 80) {
      return json({ error: `${field} deve ter entre 1 e 80 caracteres.` }, 400);
    }
  }
  if (typeof body.description !== "string" || body.description.length > 500) {
    return json({ error: "description deve ter no máximo 500 caracteres." }, 400);
  }
  if (
    !Number.isSafeInteger(body.quantity) ||
    body.quantity < 0 ||
    !Number.isSafeInteger(body.min_quantity) ||
    body.min_quantity < 0
  ) {
    return json({ error: "quantity e min_quantity devem ser inteiros não negativos." }, 400);
  }
  if (
    typeof body.responsible_agent !== "string" ||
    body.responsible_agent.trim().length < 1 ||
    body.responsible_agent.trim().length > 80
  ) {
    return json({ error: "responsible_agent deve ter entre 1 e 80 caracteres." }, 400);
  }

  const itemInput = {
    name: body.name.trim(),
    category: body.category.trim(),
    description: body.description,
    unit: body.unit.trim(),
    quantity: body.quantity,
    min_quantity: body.min_quantity,
    responsible_agent: body.responsible_agent.trim(),
  };
  try {
    const result = await env.DB.prepare(
      `INSERT INTO items
         (name, category, description, unit, quantity, min_quantity, responsible_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO NOTHING`,
    ).bind(
      itemInput.name,
      itemInput.category,
      itemInput.description,
      itemInput.unit,
      itemInput.quantity,
      itemInput.min_quantity,
      itemInput.responsible_agent,
    ).run();
    if (Number(result?.meta?.changes) !== 1) {
      return json({ error: "Já existe um item com esse nome." }, 409);
    }

    const item = await env.DB.prepare(
      `SELECT id, name, category, description, unit, quantity, min_quantity,
              responsible_agent
       FROM items WHERE id = ?`,
    ).bind(result.meta.last_row_id).first();
    if (!item) throw new Error("Inserted inventory item could not be loaded.");
    return json({ item }, 201);
  } catch (error) {
    console.error("Could not create inventory item.", error);
    return json({ error: "Não foi possível criar o item." }, 500);
  }
}
