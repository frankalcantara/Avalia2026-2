/**
 * Cloudflare Pages Function: /api/notes/:id
 *   GET    -> full note (content + tags)
 *   PUT    -> updates title, content and tags
 *   DELETE -> removes the note and any tag no other note uses
 * A note that belongs to someone else behaves exactly like a missing one (404).
 */
import { getUser, json } from "../../_lib/auth.js";
import { parseId, setNoteTags, validateNote } from "../../_lib/notes.js";

async function context(request, env, params) {
  const user = await getUser(env, request);
  if (!user) return { response: json({ error: "Não autenticado." }, 401) };
  const id = parseId(params.id);
  if (!id) return { response: json({ error: "Identificador inválido." }, 400) };
  return { user, id };
}

export async function onRequestGet({ request, env, params }) {
  const ctx = await context(request, env, params);
  if (ctx.response) return ctx.response;

  const note = await env.DB.prepare(
    "SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?1 AND user_id = ?2"
  )
    .bind(ctx.id, ctx.user.userId)
    .first();
  if (!note) return json({ error: "Nota não encontrada." }, 404);

  const { results } = await env.DB.prepare(
    `SELECT t.name FROM tags t JOIN note_tags nt ON nt.tag_id = t.id
      WHERE nt.note_id = ?1 ORDER BY t.name`
  )
    .bind(ctx.id)
    .all();

  return json({ ...note, tags: results.map((r) => r.name) });
}

export async function onRequestPut({ request, env, params }) {
  const ctx = await context(request, env, params);
  if (ctx.response) return ctx.response;

  const note = validateNote(await request.json().catch(() => null));
  if (note.error) return json({ error: note.error }, 400);

  const { meta } = await env.DB.prepare(
    `UPDATE notes SET title = ?1, content = ?2, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?3 AND user_id = ?4`
  )
    .bind(note.title, note.content, ctx.id, ctx.user.userId)
    .run();
  if (meta.changes === 0) return json({ error: "Nota não encontrada." }, 404);

  await setNoteTags(env.DB, ctx.user.userId, ctx.id, note.tags);
  return json({ id: ctx.id });
}

export async function onRequestDelete({ request, env, params }) {
  const ctx = await context(request, env, params);
  if (ctx.response) return ctx.response;

  const results = await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM note_tags WHERE note_id IN
         (SELECT id FROM notes WHERE id = ?1 AND user_id = ?2)`
    ).bind(ctx.id, ctx.user.userId),
    env.DB.prepare("DELETE FROM notes WHERE id = ?1 AND user_id = ?2").bind(ctx.id, ctx.user.userId),
    env.DB.prepare(
      "DELETE FROM tags WHERE user_id = ?1 AND id NOT IN (SELECT tag_id FROM note_tags)"
    ).bind(ctx.user.userId),
  ]);
  if (results[1].meta.changes === 0) return json({ error: "Nota não encontrada." }, 404);
  return json({ ok: true });
}
