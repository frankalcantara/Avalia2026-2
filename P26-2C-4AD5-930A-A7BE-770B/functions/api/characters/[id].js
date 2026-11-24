import { getAuthenticatedUser, jsonError, readJsonObject, validateCharacter } from "../_utils/session.js";

function parseId(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export async function onRequest({ request, env, params }) {
  const authentication = await getAuthenticatedUser(request, env);
  if (authentication.response) return authentication.response;

  const id = parseId(params.id);
  if (id === null) return jsonError("invalid_character_id", 400);

  if (request.method === "GET") {
    try {
      const character = await env.DB.prepare(
        "SELECT id, owner_id, name, class, race, level, forca, destreza, constituicao, inteligencia, sabedoria, carisma, created_at, updated_at FROM characters WHERE id = ? AND owner_id = ?"
      ).bind(id, authentication.user.user_id).first();

      if (!character) return jsonError("not_found", 404);
      return Response.json(character);
    } catch (error) {
      console.error("Character lookup failed:", error);
      return jsonError("internal_error", 500);
    }
  }

  if (request.method === "PUT") {
    const body = await readJsonObject(request);
    if (body.error) return jsonError(body.error, 400);

    const validation = validateCharacter(body.value);
    if (validation.error) return jsonError(validation.error, 400);

    const character = validation.character;
    try {
      const result = await env.DB.prepare(
        "UPDATE characters SET name = ?, class = ?, race = ?, level = ?, forca = ?, destreza = ?, constituicao = ?, inteligencia = ?, sabedoria = ?, carisma = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?"
      ).bind(
        character.name,
        character.class,
        character.race,
        character.level,
        character.forca,
        character.destreza,
        character.constituicao,
        character.inteligencia,
        character.sabedoria,
        character.carisma,
        id,
        authentication.user.user_id
      ).run();

      if (!result.meta?.changes) return jsonError("not_found", 404);

      const updatedCharacter = await env.DB.prepare(
        "SELECT id, owner_id, name, class, race, level, forca, destreza, constituicao, inteligencia, sabedoria, carisma, created_at, updated_at FROM characters WHERE id = ? AND owner_id = ?"
      ).bind(id, authentication.user.user_id).first();
      if (!updatedCharacter) return jsonError("not_found", 404);
      return Response.json(updatedCharacter);
    } catch (error) {
      console.error("Character update failed:", error);
      return jsonError("internal_error", 500);
    }
  }

  if (request.method === "DELETE") {
    try {
      const character = await env.DB.prepare(
        "SELECT id FROM characters WHERE id = ? AND owner_id = ?"
      ).bind(id, authentication.user.user_id).first();
      if (!character) return jsonError("not_found", 404);

      const existingRoll = await env.DB.prepare(
        "SELECT 1 FROM roll_log WHERE character_id = ? LIMIT 1"
      ).bind(id).first();
      if (existingRoll) return jsonError("character_has_rolls", 409);

      const result = await env.DB.prepare(
        "DELETE FROM characters WHERE id = ? AND owner_id = ?"
      ).bind(id, authentication.user.user_id).run();

      if (!result.meta?.changes) return jsonError("not_found", 404);
      return new Response(null, { status: 204 });
    } catch (error) {
      console.error("Character deletion failed:", error);
      return jsonError("internal_error", 500);
    }
  }

  return jsonError("method_not_allowed", 405);
}
