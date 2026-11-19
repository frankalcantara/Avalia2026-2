/**
 * Cloudflare Pages Function: /api/notes
 *   GET  ?q=texto&tag=nome  -> lists the user's notes (search + tag filter)
 *   POST {title, content, tags} -> creates a note
 * Every query is scoped to the logged-in user (user_id), never to client input.
 */
import { getUser, json } from "../../_lib/auth.js";
import { LIMITS, normalizeTag, setNoteTags, validateNote } from "../../_lib/notes.js";

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => "\\" + c);

export async function onRequestGet({ request, env }) {
  const user = await getUser(env, request);
  if (!user) return json({ error: "Não autenticado." }, 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, LIMITS.query);
  const tag = normalizeTag(url.searchParams.get("tag") || "");
  const pattern = q ? `%${escapeLike(q)}%` : "";

  const { results } = await env.DB.prepare(
    `SELECT n.id, n.title, substr(n.content, 1, 140) AS snippet, n.updated_at,
            GROUP_CONCAT(t.name) AS tags
       FROM notes n
       LEFT JOIN note_tags nt ON nt.note_id = n.id
       LEFT JOIN tags t ON t.id = nt.tag_id
      WHERE n.user_id = ?1
        AND (?2 = '' OR EXISTS (
              SELECT 1 FROM note_tags x JOIN tags tx ON tx.id = x.tag_id
               WHERE x.note_id = n.id AND tx.name = ?2))
        AND (?3 = ''
             OR n.title LIKE ?3 ESCAPE '\\'
             OR n.content LIKE ?3 ESCAPE '\\'
             OR EXISTS (
                  SELECT 1 FROM note_tags y JOIN tags ty ON ty.id = y.tag_id
                   WHERE y.note_id = n.id AND ty.name LIKE ?3 ESCAPE '\\'))
      GROUP BY n.id
      ORDER BY n.updated_at DESC, n.id DESC
      LIMIT 100`
  )
    .bind(user.userId, tag, pattern)
    .all();

  return json(
    results.map((row) => ({ ...row, tags: row.tags ? row.tags.split(",").sort() : [] }))
  );
}

export async function onRequestPost({ request, env }) {
  const user = await getUser(env, request);
  if (!user) return json({ error: "Não autenticado." }, 401);

  const note = validateNote(await request.json().catch(() => null));
  if (note.error) return json({ error: note.error }, 400);

  const { meta } = await env.DB.prepare(
    "INSERT INTO notes (user_id, title, content) VALUES (?1, ?2, ?3)"
  )
    .bind(user.userId, note.title, note.content)
    .run();
  const id = meta.last_row_id;
  await setNoteTags(env.DB, user.userId, id, note.tags);

  return json({ id }, 201);
}
