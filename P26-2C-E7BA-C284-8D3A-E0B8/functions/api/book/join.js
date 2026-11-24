/**
 * POST /api/book/join
 * Inscreve o usuário autenticado no livro ativo e cria seu progresso inicial.
 */
import { readSession } from "../../_lib/session.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Quem é o usuário? Vem SEMPRE do cookie assinado, nunca do corpo da requisição.
    const session = await readSession(request, env);
    if (!session) {
      return Response.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }
    const userId = session.userId;

    const activeBook = await env.DB.prepare(
      "SELECT id, title FROM books WHERE active = 1 LIMIT 1"
    ).first();

    if (!activeBook) {
      return Response.json({ ok: false, error: "no_active_book" }, { status: 404 });
    }

    const existing = await env.DB.prepare(
      "SELECT id FROM subscriptions WHERE user_id = ? AND book_id = ?"
    ).bind(userId, activeBook.id).first();

    if (existing) {
      return Response.json({ ok: false, error: "already_subscribed" }, { status: 409 });
    }

    // batch = as duas inserções acontecem juntas ou nenhuma acontece
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO subscriptions (user_id, book_id) VALUES (?, ?)"
      ).bind(userId, activeBook.id),
      env.DB.prepare(
        "INSERT INTO reading_progress (user_id, book_id, current_chapter) VALUES (?, ?, 1)"
      ).bind(userId, activeBook.id),
    ]);

    return Response.json({
      ok: true,
      message: "Inscrição realizada com sucesso.",
      book: activeBook.title,
      currentChapter: 1,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}