// GET/PATCH/DELETE /api/books/:id
import { json, route, readJson, ensureJsonIfBody } from "../../../src/http.js";
import { getSessionUser, requireUser } from "../../../src/auth.js";
import { getBook, updateBook, deleteBook } from "../../../src/books.js";

export const onRequestGet = route(async ({ request, env, params }) => {
  const me = await getSessionUser(env, request);
  return json({ book: await getBook(env, params.id, me) });
});

export const onRequestPatch = route(async ({ request, env, params }) => {
  const me = await requireUser(env, request);
  const body = await readJson(request);
  return json({ book: await updateBook(env, params.id, me, body) });
});

export const onRequestDelete = route(async ({ request, env, params }) => {
  const me = await requireUser(env, request);
  await ensureJsonIfBody(request);
  await deleteBook(env, params.id, me);
  return json({ ok: true });
});
