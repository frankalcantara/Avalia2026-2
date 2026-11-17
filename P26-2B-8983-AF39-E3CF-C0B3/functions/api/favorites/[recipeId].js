import {
  fail,
  HttpError,
  json,
  methodNotAllowed,
  requireDatabase,
  requireUser,
  validRecipeId,
} from "../../_utils.js";

export async function onRequest(context) {
  const method = context.request.method;
  if (method !== "POST" && method !== "DELETE") return methodNotAllowed("POST, DELETE");
  try {
    const user = await requireUser(context.request, context.env);
    const db = requireDatabase(context.env);
    const recipeId = validRecipeId(context.params.recipeId);
    const exists = await db.prepare("SELECT id FROM recipes WHERE id = ?").bind(recipeId).first();
    if (!exists) throw new HttpError(404, "Recipe not found");

    if (method === "POST") {
      await db.prepare(`
        INSERT INTO favorites (user_id, recipe_id) VALUES (?, ?)
        ON CONFLICT(user_id, recipe_id) DO NOTHING
      `).bind(user.userId, recipeId).run();
      return json({ ok: true }, 201);
    }

    await db.prepare("DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?")
      .bind(user.userId, recipeId).run();
    return new Response(null, { status: 204 });
  } catch (error) {
    return fail(error);
  }
}
