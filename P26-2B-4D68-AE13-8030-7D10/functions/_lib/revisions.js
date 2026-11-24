// Histórico de edições: guarda o conteúdo ANTERIOR a cada alteração.
export async function snapshotRevision(db, article, editorId) {
  await db.prepare(
    "INSERT INTO article_revisions (article_id, title, body, room_id, edited_by) VALUES (?, ?, ?, ?, ?)",
  ).bind(article.id, article.title, article.body, article.room_id, editorId).run();
}

export async function listRevisions(db, articleId, limit = 20) {
  const result = await db.prepare(`
    SELECT r.id, r.title, r.body, r.created_at, r.edited_by, u.username AS edited_by_name
    FROM article_revisions r
    LEFT JOIN discord_users u ON u.user_id = r.edited_by
    WHERE r.article_id = ?
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ?
  `).bind(articleId, limit).all();
  return result.results || [];
}
