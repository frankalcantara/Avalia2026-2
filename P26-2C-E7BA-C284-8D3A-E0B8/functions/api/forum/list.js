/**
 * GET /api/forum/list?chapter=2
 * Retorna as mensagens de um capítulo, MAS só se o progresso do usuário
 * (lido do D1) for maior ou igual ao capítulo pedido: trava anti-spoiler.
 */
import { readSession } from "../../_lib/session.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const session = await readSession(request, env);
    if (!session) {
      return Response.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }
    const userId = session.userId;

    const url = new URL(request.url);
    const chapter = Number(url.searchParams.get("chapter"));

    if (!Number.isInteger(chapter) || chapter < 1) {
      return Response.json({ ok: false, error: "invalid_chapter" }, { status: 400 });
    }

    const activeBook = await env.DB.prepare(
      "SELECT id, total_chapters FROM books WHERE active = 1 LIMIT 1"
    ).first();

    if (!activeBook) {
      return Response.json({ ok: false, error: "no_active_book" }, { status: 404 });
    }

    if (chapter > activeBook.total_chapters) {
      return Response.json({ ok: false, error: "chapter_out_of_range" }, { status: 400 });
    }

    const progress = await env.DB.prepare(
      "SELECT current_chapter FROM reading_progress WHERE user_id = ? AND book_id = ?"
    ).bind(userId, activeBook.id).first();

    if (!progress) {
      return Response.json({ ok: false, error: "progress_not_found" }, { status: 404 });
    }

    // A trava: o servidor compara com o progresso gravado no banco.
    if (progress.current_chapter < chapter) {
      return Response.json({
        ok: false,
        error: "spoiler_blocked",
        currentChapter: progress.current_chapter,
      }, { status: 403 });
    }

    const posts = await env.DB.prepare(`
      SELECT p.id, p.username, p.content, p.created_at, u.avatar
      FROM forum_posts p
      LEFT JOIN discord_users u ON u.user_id = p.user_id
      WHERE p.book_id = ? AND p.chapter = ?
      ORDER BY p.created_at ASC, p.id ASC
    `).bind(activeBook.id, chapter).all();

    return Response.json({
      ok: true,
      chapter,
      posts: posts.results || [],
    });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}