/**
 * GET /api/progress/track
 * Dados da "pista" de leitura: todos os leitores do livro ativo, com avatar
 * e capítulo atual. O front posiciona cada avatar em (capítulo / total).
 *
 * Só exige login. Mostra apenas números de capítulo, nunca conteúdo do fórum,
 * então não vaza spoiler. O userId dos outros leitores não é enviado,
 * apenas a marca "isMe" para destacar o próprio avatar.
 */
import { readSession } from "../../_lib/session.js";

const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const session = await readSession(request, env);
    if (!session) {
      return Response.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    const book = await env.DB.prepare(
      "SELECT id, title, total_chapters FROM books WHERE active = 1 LIMIT 1"
    ).first();

    if (!book) {
      return Response.json({ ok: false, error: "no_active_book" }, { status: 404 });
    }

    const rows = await env.DB.prepare(`
      SELECT rp.user_id, rp.current_chapter, u.username, u.avatar
      FROM reading_progress rp
      LEFT JOIN discord_users u ON u.user_id = rp.user_id
      WHERE rp.book_id = ?
      ORDER BY rp.current_chapter DESC, u.username ASC
    `).bind(book.id).all();

    const readers = (rows.results || []).map((r) => ({
      username: r.username || "Leitor",
      avatar: r.avatar || DEFAULT_AVATAR,
      currentChapter: r.current_chapter,
      isMe: r.user_id === session.userId,
    }));

    return Response.json({
      ok: true,
      book: { id: book.id, title: book.title, totalChapters: book.total_chapters },
      readers,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}