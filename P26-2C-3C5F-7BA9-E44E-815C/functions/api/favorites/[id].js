import { json, fail, currentUser, sameOrigin } from "../../../lib/util.js";

async function guard(request, env, params) {
  if (!sameOrigin(request)) return { res: fail("Origem não permitida.", 403) };
  const user = await currentUser(request, env);
  if (!user) return { res: fail("Entre com o Discord para favoritar.", 401) };
  const id = Number(params.id);
  if (!Number.isInteger(id)) return { res: fail("Receita não encontrada.", 404) };
  return { user, id };
}

export async function onRequestPut({ request, env, params }) {
  const g = await guard(request, env, params);
  if (g.res) return g.res;
  const exists = await env.DB.prepare("SELECT 1 FROM recipes WHERE id = ?").bind(g.id).first();
  if (!exists) return fail("Receita não encontrada.", 404);
  await env.DB.prepare("INSERT OR IGNORE INTO favorites (user_id, recipe_id) VALUES (?, ?)").bind(g.user.id, g.id).run();
  return json({ is_fav: 1 });
}

export async function onRequestDelete({ request, env, params }) {
  const g = await guard(request, env, params);
  if (g.res) return g.res;
  await env.DB.prepare("DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?").bind(g.user.id, g.id).run();
  return json({ is_fav: 0 });
}
