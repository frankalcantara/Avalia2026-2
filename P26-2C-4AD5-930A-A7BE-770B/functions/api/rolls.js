import {
  CHARACTER_ATTRIBUTE_FIELDS,
  getAuthenticatedUser,
  jsonError,
  readJsonObject,
} from "./_utils/session.js";

const ATTRIBUTES = new Set(CHARACTER_ATTRIBUTE_FIELDS);
const DIE_SIDES = new Map([
  ["d4", 4],
  ["d6", 6],
  ["d8", 8],
  ["d10", 10],
  ["d12", 12],
  ["d20", 20],
]);
const UINT32_RANGE = 2 ** 32;

function randomDieResult(sides) {
  const limit = UINT32_RANGE - (UINT32_RANGE % sides);
  const value = new Uint32Array(1);

  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);

  return (value[0] % sides) + 1;
}

export async function onRequest({ request, env }) {
  const authentication = await getAuthenticatedUser(request, env);
  if (authentication.response) return authentication.response;

  if (request.method === "GET") {
    try {
      const result = await env.DB.prepare(
        "SELECT roll_log.id, roll_log.user_id, roll_log.username, roll_log.character_id, characters.name AS character_name, roll_log.attribute, roll_log.die, roll_log.result, roll_log.modifier, roll_log.total, roll_log.created_at FROM roll_log INNER JOIN characters ON characters.id = roll_log.character_id ORDER BY roll_log.created_at DESC, roll_log.id DESC LIMIT 50"
      ).all();
      return Response.json(result.results);
    } catch (error) {
      console.error("Roll history lookup failed:", error);
      return jsonError("internal_error", 500);
    }
  }

  if (request.method === "POST") {
    const body = await readJsonObject(request);
    if (body.error) return jsonError(body.error, 400);

    const value = body.value;
    const keys = Object.keys(value);
    if (keys.some((key) => !["characterId", "attribute", "die"].includes(key))) {
      return jsonError("Unexpected roll field.", 400);
    }
    if (!Number.isSafeInteger(value.characterId) || value.characterId < 1) {
      return jsonError("characterId must be a positive integer.", 400);
    }
    if (typeof value.attribute !== "string" || !ATTRIBUTES.has(value.attribute)) {
      return jsonError("attribute is invalid.", 400);
    }
    if (typeof value.die !== "string" || !DIE_SIDES.has(value.die)) {
      return jsonError("die is invalid.", 400);
    }

    try {
      const character = await env.DB.prepare(
        `SELECT id, name, ${value.attribute} AS attribute_value FROM characters WHERE id = ? AND owner_id = ?`
      ).bind(value.characterId, authentication.user.user_id).first();

      if (!character) return jsonError("not_found", 404);

      const result = randomDieResult(DIE_SIDES.get(value.die));
      const modifier = Math.floor((character.attribute_value - 10) / 2);
      const total = result + modifier;
      const roll = await env.DB.prepare(
        "INSERT INTO roll_log (user_id, username, character_id, attribute, die, result, modifier, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, user_id, username, character_id, attribute, die, result, modifier, total, created_at"
      ).bind(
        authentication.user.user_id,
        authentication.user.username,
        character.id,
        value.attribute,
        value.die,
        result,
        modifier,
        total
      ).first();

      return Response.json({ ...roll, character_name: character.name }, { status: 201 });
    } catch (error) {
      console.error("Roll creation failed:", error);
      return jsonError("internal_error", 500);
    }
  }

  return jsonError("method_not_allowed", 405);
}
