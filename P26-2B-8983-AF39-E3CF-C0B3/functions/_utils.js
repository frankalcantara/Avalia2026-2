const SESSION_COOKIE = "__Host-discord_session";
const STATE_COOKIE = "__Host-discord_oauth_state";
const SESSION_TTL = 60 * 60 * 24 * 7;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}

export function fail(error) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, error.status);
  }
  return json({ error: "Internal server error" }, 500);
}

export function methodNotAllowed(allow) {
  return json({ error: "Method not allowed" }, 405, { Allow: allow });
}

export function requireDatabase(env) {
  if (!env.DB) throw new HttpError(503, "D1 database is not configured");
  return env.DB;
}

function getCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  for (const cookie of cookies.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name) {
      return cookie.slice(separator + 1).trim();
    }
  }
  return null;
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function requireSessionSecret(env) {
  const secret = env.SESSION_SECRET;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new HttpError(503, "SESSION_SECRET must contain at least 32 characters");
  }
  return secret;
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function signSession(user, env) {
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify({
    userId: user.userId,
    username: user.username,
    avatar: user.avatar,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL,
  })));
  const signature = encodeBase64Url(await hmac(payload, requireSessionSecret(env)));
  return `${payload}.${signature}`;
}

export async function readSession(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  try {
    const secret = requireSessionSecret(env);
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra !== undefined) return null;
    const suppliedSignature = decodeBase64Url(signature);
    const valid = await crypto.subtle.verify(
      "HMAC",
      await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      ),
      suppliedSignature,
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;
    const data = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    if (
      typeof data.userId !== "string" ||
      typeof data.username !== "string" ||
      typeof data.exp !== "number" ||
      data.exp <= Math.floor(Date.now() / 1000) ||
      (data.avatar !== null && typeof data.avatar !== "string")
    ) return null;
    return { userId: data.userId, username: data.username, avatar: data.avatar };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return null;
  }
}

export async function requireUser(request, env) {
  const user = await readSession(request, env);
  if (!user) throw new HttpError(401, "Authentication required");
  return user;
}

export function sessionCookie(value, maxAge = SESSION_TTL) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function stateCookie(value, maxAge = 600) {
  return `${STATE_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearStateCookie() {
  return stateCookie("", 0);
}

export function clearSessionCookie() {
  return sessionCookie("", 0);
}

export function readOAuthStateCookie(request) {
  return getCookie(request, STATE_COOKIE);
}

export async function readJson(request, maxBytes = 65536) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new HttpError(415, "Content-Type must be application/json");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, "Request body is too large");
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "JSON body must be an object");
  }
  return value;
}

function text(value, field, maxLength, { required = true } = {}) {
  if (typeof value !== "string") {
    if (!required && (value === null || value === undefined)) return "";
    throw new HttpError(400, `${field} must be a string`);
  }
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maxLength) {
    throw new HttpError(400, `${field} must be ${required ? "non-empty and " : ""}at most ${maxLength} characters`);
  }
  return normalized;
}

function integer(value, field, min, max) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${field} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function validateRecipe(body) {
  const title = text(body.title, "title", 120);
  const titleKey = title.normalize("NFKC").toLowerCase();
  const description = text(body.description ?? "", "description", 2000, { required: false });
  const prepTime = integer(body.prepTime, "prepTime", 1, 1440);
  const servings = integer(body.servings, "servings", 1, 100);
  if (!Array.isArray(body.ingredients) || body.ingredients.length < 1 || body.ingredients.length > 100) {
    throw new HttpError(400, "ingredients must contain between 1 and 100 items");
  }
  if (!Array.isArray(body.steps) || body.steps.length < 1 || body.steps.length > 50) {
    throw new HttpError(400, "steps must contain between 1 and 50 items");
  }
  const ingredients = body.ingredients.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpError(400, `ingredients[${index}] must be an object`);
    }
    const name = text(item.name, `ingredients[${index}].name`, 100);
    const quantity = item.quantity;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) {
      throw new HttpError(400, `ingredients[${index}].quantity must be a positive number`);
    }
    const unit = text(item.unit, `ingredients[${index}].unit`, 30);
    const nameKey = name.normalize("NFKC").toLowerCase();
    if (nameKey.length > 200) throw new HttpError(400, `ingredients[${index}].name is too long after normalization`);
    return { name, nameKey, quantity, unit };
  });
  const steps = body.steps.map((step, index) => text(step, `steps[${index}]`, 1000));
  return { title, titleKey, description, prepTime, servings, ingredients, steps };
}

function escapeLike(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export async function listRecipes(db, userId, filters = {}) {
  const conditions = [];
  const bindings = [userId];
  if (filters.id) {
    conditions.push("r.id = ?");
    bindings.push(filters.id);
  }
  if (filters.q) {
    conditions.push("r.title_key LIKE ? ESCAPE '\\'");
    bindings.push(`%${escapeLike(filters.q.normalize("NFKC").toLowerCase())}%`);
  }
  if (filters.ingredient) {
    conditions.push(`EXISTS (
      SELECT 1 FROM recipe_ingredients ri
      WHERE ri.recipe_id = r.id AND ri.name_key LIKE ? ESCAPE '\\'
    )`);
    bindings.push(`%${escapeLike(filters.ingredient.normalize("NFKC").toLowerCase())}%`);
  }
  if (filters.maxTime !== undefined) {
    conditions.push("r.prep_time <= ?");
    bindings.push(filters.maxTime);
  }
  if (filters.favoritesOnly) conditions.push("EXISTS (SELECT 1 FROM favorites own WHERE own.recipe_id = r.id AND own.user_id = ?)");
  if (filters.favoritesOnly) bindings.push(userId);

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = await db.prepare(`
    SELECT r.id, r.title, r.description, r.prep_time AS prepTime, r.servings,
      u.user_id AS authorUserId, u.username AS authorUsername, u.avatar AS authorAvatar,
      EXISTS (SELECT 1 FROM favorites f WHERE f.recipe_id = r.id AND f.user_id = ?) AS isFavorite
    FROM recipes r
    JOIN discord_users u ON u.user_id = r.author_user_id
    ${where}
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT 100
  `).bind(...bindings).all();
  const rows = query.results || [];
  if (!rows.length) return [];

  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(", ");
  const [ingredientsResult, stepsResult] = await Promise.all([
    db.prepare(`
      SELECT recipe_id AS recipeId, name, quantity, unit
      FROM recipe_ingredients WHERE recipe_id IN (${placeholders})
      ORDER BY recipe_id, position
    `).bind(...ids).all(),
    db.prepare(`
      SELECT recipe_id AS recipeId, content
      FROM recipe_steps WHERE recipe_id IN (${placeholders})
      ORDER BY recipe_id, position
    `).bind(...ids).all(),
  ]);
  const ingredientsByRecipe = new Map(ids.map((id) => [id, []]));
  const stepsByRecipe = new Map(ids.map((id) => [id, []]));
  for (const item of ingredientsResult.results || []) {
    ingredientsByRecipe.get(item.recipeId)?.push({
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit,
    });
  }
  for (const item of stepsResult.results || []) stepsByRecipe.get(item.recipeId)?.push(item.content);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    prepTime: Number(row.prepTime),
    servings: Number(row.servings),
    author: {
      userId: row.authorUserId,
      username: row.authorUsername,
      avatar: row.authorAvatar,
    },
    ingredients: ingredientsByRecipe.get(row.id) || [],
    steps: stepsByRecipe.get(row.id) || [],
    isFavorite: Boolean(row.isFavorite),
  }));
}

export function validRecipeId(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "Invalid recipe id");
  }
  return value.toLowerCase();
}

export function validateDiscordProfile(profile) {
  if (
    !profile ||
    typeof profile.id !== "string" ||
    !/^\d{1,32}$/.test(profile.id) ||
    typeof profile.username !== "string" ||
    !profile.username.trim() ||
    profile.username.length > 80 ||
    (profile.global_name !== null && profile.global_name !== undefined && typeof profile.global_name !== "string") ||
    (profile.avatar !== null && profile.avatar !== undefined && typeof profile.avatar !== "string")
  ) {
    throw new HttpError(502, "Discord returned an invalid user profile");
  }
  const userId = profile.id;
  const username = (profile.global_name || profile.username).trim().slice(0, 80);
  const avatar = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${userId}/${encodeURIComponent(profile.avatar)}.${profile.avatar.startsWith("a_") ? "gif" : "png"}`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) % 6n)}.png`;
  return { userId, username, avatar };
}

export function randomToken() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}
