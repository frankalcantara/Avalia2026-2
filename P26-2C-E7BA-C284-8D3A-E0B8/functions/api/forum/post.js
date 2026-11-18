/**
 * POST /api/forum/post   corpo: { "chapter": 2, "content": "texto" }
 * Publica uma mensagem no fórum de um capítulo.
 *
 * Regras (todas validadas aqui no servidor):
 *  - precisa estar autenticado (cookie assinado);
 *  - o capítulo precisa existir no livro ativo;
 *  - precisa estar inscrito no livro;
 *  - só pode postar em capítulos que já alcançou (anti-spoiler também na escrita);
 *  - a mensagem não pode ser vazia nem passar de 2000 caracteres.
 */
import { readSession } from "../../_lib/session.js";

const MAX_CONTENT_LENGTH = 2000;

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const session = await readSession(request, env);
    if (!session) {
      return Response.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }
    const userId = session.userId;
    const username = session.username || "Leitor";

    const body = await request.json().catch(() => ({}));
    const chapter = Number(body.chapter);
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!Number.isInteger(chapter) || chapter < 1) {
      return Response.json({ ok: false, error: "invalid_chapter" }, { status: 400 });
    }

    if (!content) {
      return Response.json({ ok: false, error: "empty_content" }, { status: 400 });
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return Response.json({
        ok: false,
        error: "content_too_long",
        maxLength: MAX_CONTENT_LENGTH,
      }, { status: 400 });
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

    // Quem não tem registro de progresso não está inscrito.
    const progress = await env.DB.prepare(
      "SELECT current_chapter FROM reading_progress WHERE user_id = ? AND book_id = ?"
    ).bind(userId, activeBook.id).first();

    if (!progress) {
      return Response.json({ ok: false, error: "not_subscribed" }, { status: 403 });
    }

    if (progress.current_chapter < chapter) {
      return Response.json({
        ok: false,
        error: "spoiler_blocked",
        currentChapter: progress.current_chapter,
      }, { status: 403 });
    }

    await env.DB.prepare(
      "INSERT INTO forum_posts (user_id, username, book_id, chapter, content) VALUES (?, ?, ?, ?, ?)"
    ).bind(userId, username, activeBook.id, chapter, content).run();

    return Response.json({ ok: true, message: "Mensagem publicada." }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}