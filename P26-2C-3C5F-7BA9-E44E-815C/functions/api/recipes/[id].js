import { json, fail, currentUser } from "../../../lib/util.js";

export async function onRequestGet({ request, env, params }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return fail("Receita não encontrada.", 404);
  const user = await currentUser(request, env);

  const recipe = await env.DB.prepare(
    `SELECT r.id, r.title, r.prep_time_min, r.servings, u.username AS author,
            EXISTS (SELECT 1 FROM favorites f WHERE f.recipe_id = r.id AND f.user_id = ?) AS is_fav
     FROM recipes r JOIN users u ON u.id = r.user_id WHERE r.id = ?`
  ).bind(user?.id ?? null, id).first();
  if (!recipe) return fail("Receita não encontrada.", 404);

  const [ings, steps] = await env.DB.batch([
    env.DB.prepare("SELECT amount, unit, name FROM ingredients WHERE recipe_id = ? ORDER BY position").bind(id),
    env.DB.prepare("SELECT text FROM steps WHERE recipe_id = ? ORDER BY position").bind(id),
  ]);
  return json({ recipe: { ...recipe, ingredients: ings.results, steps: steps.results.map((s) => s.text) } });
}
