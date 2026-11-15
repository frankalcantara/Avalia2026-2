/**
 * GET /api/me
 * Diz ao front quem está logado e em que ponto está no livro ativo.
 * Sem sessão válida responde 401, e o front mostra o botão "Entrar com Discord".
 */
import { readSession } from "../_lib/session.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const session = await readSession(request, env);
    if (!session) {
      return Response.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    const user = {
      userId: session.userId,
      username: session.username,
      avatar: session.avatar,
    };

    const book = await env.DB.prepare(
      "SELECT id, title, total_chapters FROM books WHERE active = 1 LIMIT 1"
    ).first();

    // Sem livro ativo o usuário continua logado, só não há o que ler.
    if (!book) {
      return Response.json({ ok: true, user, book: null, subscribed: false, currentChapter: null });
    }

    const progress = await env.DB.prepare(
      "SELECT current_chapter FROM reading_progress WHERE user_id = ? AND book_id = ?"
    ).bind(session.userId, book.id).first();

    return Response.json({
      ok: true,
      user,
      book: { id: book.id, title: book.title, totalChapters: book.total_chapters },
      subscribed: Boolean(progress),
      currentChapter: progress ? progress.current_chapter : null,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}