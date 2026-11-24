// GET /api/books (lista pública com filtros) e POST /api/books (cria livro do usuário logado).
import { json, route, readJson } from "../../../src/http.js";
import { getSessionUser, requireUser } from "../../../src/auth.js";
import { listBooks, createBook } from "../../../src/books.js";

export const onRequestGet = route(async ({ request, env }) => {
  const me = await getSessionUser(env, request);
  return json({ books: await listBooks(env, new URL(request.url), me) });
});

export const onRequestPost = route(async ({ request, env }) => {
  const me = await requireUser(env, request);
  const body = await readJson(request);
  return json({ book: await createBook(env, me, body) }, 201);
});
