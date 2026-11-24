/**
 * GET /api/book/active
 * Retorna o livro ativo da rodada.
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const book = await env.DB.prepare(`
      SELECT
        id,
        title,
        total_chapters
      FROM books
      WHERE active = 1
      LIMIT 1
    `).first();

    if (!book) {
      return Response.json(
        {
          ok: false,
          error: "no_active_book"
        },
        {
          status: 404
        }
      );
    }

    return Response.json({
      ok: true,
      id: book.id,
      title: book.title,
      totalChapters: book.total_chapters
    });

  } catch (error) {
    console.error(error);

    return Response.json(
      {
        ok: false,
        error: "server_error"
      },
      {
        status: 500
      }
    );
  }
}