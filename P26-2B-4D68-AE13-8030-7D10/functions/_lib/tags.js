export const MAX_TAGS = 5;
export const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{1,19}$/;

// "Segurança de Redes" -> "seguranca-de-redes"
export function normalizeTag(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
}

export function parseTags(value) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const tags = [];
  for (const item of raw) {
    const tag = normalizeTag(item);
    if (!tag) continue;
    if (!TAG_PATTERN.test(tag)) return { error: `Etiqueta inválida: "${tag}". Use 2 a 20 letras, números ou hífen.` };
    if (!tags.includes(tag)) tags.push(tag);
    if (tags.length > MAX_TAGS) return { error: `Use no máximo ${MAX_TAGS} etiquetas por artigo.` };
  }
  return { tags };
}

export async function replaceTags(db, articleId, tags) {
  await db.prepare("DELETE FROM article_tags WHERE article_id = ?").bind(articleId).run();
  if (!tags.length) return;
  const statement = db.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag) VALUES (?, ?)");
  await db.batch(tags.map((tag) => statement.bind(articleId, tag)));
}

export async function listTags(db, limit = 30) {
  const result = await db.prepare(`
    SELECT tag, COUNT(*) AS total
    FROM article_tags
    GROUP BY tag
    ORDER BY total DESC, tag ASC
    LIMIT ?
  `).bind(limit).all();
  return result.results || [];
}

export function splitTags(value) {
  return value ? String(value).split(",").filter(Boolean) : [];
}
