import {
  fail,
  HttpError,
  json,
  listRecipes,
  methodNotAllowed,
  readJson,
  readSession,
  requireDatabase,
  requireUser,
  validateRecipe,
} from "../../_utils.js";

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (request.method === "GET") {
    try {
      requireDatabase(env);
      const url = new URL(request.url);
      const q = url.searchParams.get("q");
      const ingredient = url.searchParams.get("ingredient");
      const rawMaxTime = url.searchParams.get("maxTime");
      if (q !== null && q.length > 120) throw new HttpError(400, "q must be at most 120 characters");
      if (ingredient !== null && ingredient.length > 100) {
        throw new HttpError(400, "ingredient must be at most 100 characters");
      }
      let maxTime;
      if (rawMaxTime !== null) {
        if (!/^\d{1,4}$/.test(rawMaxTime) || Number(rawMaxTime) < 1 || Number(rawMaxTime) > 1440) {
          throw new HttpError(400, "maxTime must be an integer between 1 and 1440");
        }
        maxTime = Number(rawMaxTime);
      }
      const user = await readSession(request, env);
      const recipes = await listRecipes(db, user?.userId || "", {
        q: q?.trim() || undefined,
        ingredient: ingredient?.trim() || undefined,
        maxTime,
      });
      return json({ recipes });
    } catch (error) {
      return fail(error);
    }
  }

  if (request.method === "POST") {
    try {
      const user = await requireUser(request, env);
      requireDatabase(env);
      const recipe = validateRecipe(await readJson(request));
      const id = crypto.randomUUID();
      const ingredientsSql = recipe.ingredients.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
      const ingredientsBindings = recipe.ingredients.flatMap((item, index) => [
        id, index + 1, item.name, item.nameKey, item.quantity, item.unit,
      ]);
      const stepsSql = recipe.steps.map(() => "(?, ?, ?)").join(", ");
      const stepsBindings = recipe.steps.flatMap((step, index) => [id, index + 1, step]);
      await db.batch([
        db.prepare(`
          INSERT INTO recipes (id, author_user_id, title, title_key, description, prep_time, servings)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(id, user.userId, recipe.title, recipe.titleKey, recipe.description, recipe.prepTime, recipe.servings),
        db.prepare(`
          INSERT INTO recipe_ingredients (recipe_id, position, name, name_key, quantity, unit)
          VALUES ${ingredientsSql}
        `).bind(...ingredientsBindings),
        db.prepare(`
          INSERT INTO recipe_steps (recipe_id, position, content)
          VALUES ${stepsSql}
        `).bind(...stepsBindings),
      ]);
      return json({
        recipe: {
          id,
          title: recipe.title,
          description: recipe.description,
          prepTime: recipe.prepTime,
          servings: recipe.servings,
          author: { userId: user.userId, username: user.username, avatar: user.avatar },
          ingredients: recipe.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
          steps: recipe.steps,
          isFavorite: false,
        },
      }, 201);
    } catch (error) {
      return fail(error);
    }
  }
  return methodNotAllowed("GET, POST");
}
