import { json, fail, currentUser } from "../../../lib/util.js";

// Livro de receitas pessoal: só as receitas favoritadas pelo usuário logado.
export async function onRequestGet({ request, env }) {
  const user = await currentUser(request, env);
  if (!user) return fail("Entre com o Discord para ver seu livro.", 401);
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.title, r.prep_time_min, r.servings, u.username AS author, 1 AS is_fav
     FROM favorites f JOIN recipes r ON r.id = f.recipe_id JOIN users u ON u.id = r.user_id
     WHERE f.user_id = ? ORDER BY r.title`
  ).bind(user.id).all();
  return json({ recipes: results });
}
