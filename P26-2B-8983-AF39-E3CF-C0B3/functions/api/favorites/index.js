import {
  fail,
  json,
  listRecipes,
  methodNotAllowed,
  requireDatabase,
  requireUser,
} from "../../_utils.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") return methodNotAllowed("GET");
  try {
    const user = await requireUser(context.request, context.env);
    const recipes = await listRecipes(requireDatabase(context.env), user.userId, { favoritesOnly: true });
    return json({ recipes });
  } catch (error) {
    return fail(error);
  }
}
