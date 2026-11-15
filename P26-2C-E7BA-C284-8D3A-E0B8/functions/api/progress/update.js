/**
 * POST /api/progress/update   corpo: { "chapter": 3 }
 * Atualiza o capítulo atual do usuário autenticado no livro ativo.
 */
import { readSession } from "../../_lib/session.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const session = await readSession(request, env);
    if (!session) {
      return Response.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }
    const userId = session.userId;

    const body = await request.json().catch(() => ({}));
    const chapter = Number(body.chapter);

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

    const subscription = await env.DB.prepare(
      "SELECT id FROM subscriptions WHERE user_id = ? AND book_id = ?"
    ).bind(userId, activeBook.id).first();

    if (!subscription) {
      return Response.json({ ok: false, error: "not_subscribed" }, { status: 403 });
    }

    await env.DB.prepare(
      "UPDATE reading_progress SET current_chapter = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND book_id = ?"
    ).bind(chapter, userId, activeBook.id).run();

    return Response.json({ ok: true, chapter });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}