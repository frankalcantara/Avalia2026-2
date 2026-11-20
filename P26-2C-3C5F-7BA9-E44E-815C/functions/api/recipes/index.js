import { json, fail, currentUser, sameOrigin, likePattern } from "../../../lib/util.js";
import { validateRecipe } from "../../../lib/validate.js";

// Busca por nome do prato, tempo máximo de preparo ou ingrediente.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const ing = (url.searchParams.get("ingredient") || "").trim().slice(0, 80);
  const maxTime = Number(url.searchParams.get("max_time"));
  const user = await currentUser(request, env);

  const where = [];
  const args = [user?.id ?? null];
  if (q) { where.push("r.title LIKE ? ESCAPE '\\'"); args.push(likePattern(q)); }
  if (Number.isInteger(maxTime) && maxTime > 0) { where.push("r.prep_time_min <= ?"); args.push(maxTime); }
  if (ing) {
    where.push("EXISTS (SELECT 1 FROM ingredients i WHERE i.recipe_id = r.id AND i.name LIKE ? ESCAPE '\\')");
    args.push(likePattern(ing));
  }
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.title, r.prep_time_min, r.servings, u.username AS author,
            EXISTS (SELECT 1 FROM favorites f WHERE f.recipe_id = r.id AND f.user_id = ?) AS is_fav
     FROM recipes r JOIN users u ON u.id = r.user_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY r.created_at DESC LIMIT 50`
  ).bind(...args).all();
  return json({ recipes: results });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return fail("Origem não permitida.", 403);
  const user = await currentUser(request, env);
  if (!user) return fail("Entre com o Discord para publicar receitas.", 401);

  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM recipes WHERE user_id = ? AND created_at > ?")
    .bind(user.id, Date.now() - 24 * 3600 * 1000).first();
  if (recent.n >= 20) return fail("Limite de 20 receitas por dia atingido.", 429);

  let body;
  try { body = await request.json(); } catch { return fail("Envie um JSON válido."); }
  const { value, errors } = validateRecipe(body);
  if (errors) return json({ error: errors[0], errors }, 422);

  const row = await env.DB.prepare(
    "INSERT INTO recipes (user_id, title, prep_time_min, servings, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id"
  ).bind(user.id, value.title, value.prep_time_min, value.servings, Date.now()).first();

  await env.DB.batch([
    ...value.ingredients.map((i, n) =>
      env.DB.prepare("INSERT INTO ingredients (recipe_id, position, amount, unit, name) VALUES (?, ?, ?, ?, ?)")
        .bind(row.id, n, i.amount, i.unit, i.name)),
    ...value.steps.map((s, n) =>
      env.DB.prepare("INSERT INTO steps (recipe_id, position, text) VALUES (?, ?, ?)").bind(row.id, n, s)),
  ]);
  return json({ id: row.id }, 201);
}
