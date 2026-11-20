import { getAuthenticatedUser, jsonError, readJsonObject, validateCharacter } from "./_utils/session.js";

export async function onRequest({ request, env }) {
  const authentication = await getAuthenticatedUser(request, env);
  if (authentication.response) return authentication.response;

  if (request.method === "GET") {
    try {
      const result = await env.DB.prepare(
        "SELECT id, owner_id, name, class, race, level, forca, destreza, constituicao, inteligencia, sabedoria, carisma, created_at, updated_at FROM characters WHERE owner_id = ? ORDER BY id DESC"
      ).bind(authentication.user.user_id).all();
      return Response.json(result.results);
    } catch (error) {
      console.error("Character list failed:", error);
      return jsonError("internal_error", 500);
    }
  }

  if (request.method === "POST") {
    const body = await readJsonObject(request);
    if (body.error) return jsonError(body.error, 400);

    const validation = validateCharacter(body.value);
    if (validation.error) return jsonError(validation.error, 400);

    const character = validation.character;
    try {
      const result = await env.DB.prepare(
        "INSERT INTO characters (owner_id, name, class, race, level, forca, destreza, constituicao, inteligencia, sabedoria, carisma) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, owner_id, name, class, race, level, forca, destreza, constituicao, inteligencia, sabedoria, carisma, created_at, updated_at"
      ).bind(
        authentication.user.user_id,
        character.name,
        character.class,
        character.race,
        character.level,
        character.forca,
        character.destreza,
        character.constituicao,
        character.inteligencia,
        character.sabedoria,
        character.carisma
      ).first();
      return Response.json(result, { status: 201 });
    } catch (error) {
      console.error("Character creation failed:", error);
      return jsonError("internal_error", 500);
    }
  }

  return jsonError("method_not_allowed", 405);
}
