function getSessionId(request) {
  const cookies = request.headers.get("Cookie") || "";
  const cookie = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("discord_session="));
  const sessionId = cookie ? cookie.slice("discord_session=".length) : "";
  return /^[a-f0-9]{64}$/i.test(sessionId) ? sessionId : null;
}

export async function getAuthenticatedUser(request, env) {
  const sessionId = getSessionId(request);
  if (!sessionId) {
    return { response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }

  if (!env.DB) {
    console.error("Session validation failed: D1 binding is not configured.");
    return { response: Response.json({ error: "database_unavailable" }, { status: 500 }) };
  }

  try {
    const user = await env.DB.prepare(
      "SELECT discord_users.user_id, discord_users.username FROM sessions INNER JOIN discord_users ON discord_users.user_id = sessions.user_id WHERE sessions.id = ? AND datetime(sessions.expires_at) > CURRENT_TIMESTAMP LIMIT 1"
    ).bind(sessionId).first();

    if (!user) {
      return { response: Response.json({ error: "unauthorized" }, { status: 401 }) };
    }

    return { user };
  } catch (error) {
    console.error("Session validation failed:", error);
    return { response: Response.json({ error: "internal_error" }, { status: 500 }) };
  }
}

export function isJsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function readJsonObject(request) {
  try {
    const value = await request.json();
    return isJsonObject(value) ? { value } : { error: "Request body must be a JSON object." };
  } catch {
    return { error: "Request body must contain valid JSON." };
  }
}

export function jsonError(error, status) {
  return Response.json({ error }, { status });
}

export const CHARACTER_ATTRIBUTE_FIELDS = [
  "forca",
  "destreza",
  "constituicao",
  "inteligencia",
  "sabedoria",
  "carisma",
];

const CHARACTER_FIELDS = ["name", "class", "race", "level", ...CHARACTER_ATTRIBUTE_FIELDS];

export function validateCharacter(value) {
  const unexpected = Object.keys(value).filter((key) => !CHARACTER_FIELDS.includes(key));
  if (unexpected.length) {
    return { error: `Unexpected field: ${unexpected[0]}.` };
  }

  for (const field of ["name", "class", "race"]) {
    if (typeof value[field] !== "string" || !value[field].trim()) {
      return { error: `${field} must be a non-empty string.` };
    }

    const maxLength = field === "name" ? 80 : 50;
    if (value[field].trim().length > maxLength) {
      return { error: `${field} must be at most ${maxLength} characters.` };
    }
  }

  if (!Number.isInteger(value.level) || value.level < 1 || value.level > 20) {
    return { error: "level must be an integer from 1 to 20." };
  }

  for (const field of CHARACTER_ATTRIBUTE_FIELDS) {
    if (!Number.isInteger(value[field]) || value[field] < 1 || value[field] > 30) {
      return { error: `${field} must be an integer from 1 to 30.` };
    }
  }

  return {
    character: {
      name: value.name.trim(),
      class: value.class.trim(),
      race: value.race.trim(),
      level: value.level,
      ...Object.fromEntries(CHARACTER_ATTRIBUTE_FIELDS.map((field) => [field, value[field]])),
    },
  };
}
