// Business rules for notes and tags. The server never trusts the client:
// every limit below is enforced here, on every write.

export const LIMITS = { title: 120, content: 50000, tags: 10, tagLength: 30, query: 100 };
export const TAG_RE = /^[\p{L}\p{N}_-]{1,30}$/u;

export function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function normalizeTag(raw) {
  return String(raw ?? "").trim().toLowerCase().replace(/^#/, "");
}

// Returns { title, content, tags } or { error }.
export function validateNote(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Corpo da requisição inválido." };
  }
  const title = String(body.title ?? "").trim();
  const content = typeof body.content === "string" ? body.content : "";
  const rawTags = Array.isArray(body.tags) ? body.tags : [];

  if (!title) return { error: "Informe um título." };
  if (title.length > LIMITS.title) return { error: `O título aceita até ${LIMITS.title} caracteres.` };
  if (content.length > LIMITS.content) return { error: `A nota aceita até ${LIMITS.content} caracteres.` };

  const tags = [...new Set(rawTags.map(normalizeTag).filter(Boolean))];
  if (tags.length > LIMITS.tags) return { error: `Use no máximo ${LIMITS.tags} tags por nota.` };
  if (tags.some((t) => !TAG_RE.test(t))) {
    return { error: "Tags aceitam letras, números, hífen e sublinhado (até 30 caracteres)." };
  }
  return { title, content, tags };
}

// Replaces the tags of a note and removes tags that no note uses anymore.
export async function setNoteTags(db, userId, noteId, tags) {
  const statements = [db.prepare("DELETE FROM note_tags WHERE note_id = ?1").bind(noteId)];
  for (const name of tags) {
    statements.push(
      db.prepare("INSERT OR IGNORE INTO tags (user_id, name) VALUES (?1, ?2)").bind(userId, name)
    );
  }
  for (const name of tags) {
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO note_tags (note_id, tag_id) SELECT ?1, id FROM tags WHERE user_id = ?2 AND name = ?3"
        )
        .bind(noteId, userId, name)
    );
  }
  statements.push(
    db
      .prepare("DELETE FROM tags WHERE user_id = ?1 AND id NOT IN (SELECT tag_id FROM note_tags)")
      .bind(userId)
  );
  await db.batch(statements);
}
