function getId(request){
  return request.headers.get('Cookie')?.match(/discord_id=([^;]+)/)?.[1];
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const id = getId(request);

  // GET ?action=me
  if (action === 'me') {
    if (!id) return Response.json({ error: 'unauthorized' }, { status: 401 });
    const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
    return Response.json(u);
  }

  // GET ?action=book -> livro atual + leitores para a pista
  if (action === 'book') {
    const book = await env.DB.prepare('SELECT * FROM books WHERE is_current=1').first();
    const readers = await env.DB.prepare(
      `SELECT u.username, u.avatar, e.current_chapter, e.current_page
       FROM enrollments e JOIN users u ON u.id=e.user_id WHERE e.book_id=?`
    ).bind(book.id).all();
    return Response.json({ book, readers: readers.results });
  }

  // GET ?action=forum&book_id=1&chapter=3 -> SÓ libera se progresso >= capítulo
  if (action === 'forum') {
    if (!id) return Response.json({ error: 'Faça login com Discord' }, { status: 401 });
    const book_id = url.searchParams.get('book_id');
    const chapter = Number(url.searchParams.get('chapter'));
    const prog = await env.DB.prepare(
      'SELECT current_chapter FROM enrollments WHERE user_id=? AND book_id=?'
    ).bind(id, book_id).first();
    if (!prog || prog.current_chapter < chapter)
      return Response.json({ error: `Bloqueado: avance até o capítulo ${chapter} para ver esta discussão.` }, { status: 403 });
    const msgs = await env.DB.prepare(
      'SELECT * FROM forum_messages WHERE book_id=? AND chapter=? ORDER BY created_at ASC'
    ).bind(book_id, chapter).all();
    return Response.json({ messages: msgs.results });
  }

  return Response.json({ ok: true, key: 'P26-2B-51BF-6EC8-E5DE-8952' });
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const id = getId(request);
  if (!id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const b = await request.json().catch(() => ({}));

  // POST ?action=enroll
  if (action === 'enroll') {
    const book = await env.DB.prepare('SELECT * FROM books WHERE is_current=1').first();
    await env.DB.prepare('INSERT OR IGNORE INTO enrollments (user_id, book_id) VALUES (?,?)').bind(id, book.id).run();
    return Response.json({ ok: true });
  }

  // POST ?action=progress
  if (action === 'progress') {
    const book = await env.DB.prepare('SELECT * FROM books WHERE id=?').bind(b.book_id).first();
    if (!book) return Response.json({ error: 'book not found' }, { status: 404 });
    if (b.current_chapter < 0 || b.current_page < 0 || b.current_chapter > book.total_chapters || b.current_page > book.total_pages)
      return Response.json({ error: 'Progresso inválido' }, { status: 400 });
    await env.DB.prepare(
      `UPDATE enrollments SET current_chapter=?, current_page=?, updated_at=datetime('now') WHERE user_id=? AND book_id=?`
    ).bind(b.current_chapter, b.current_page, id, b.book_id).run();
    return Response.json({ ok: true });
  }

  // POST ?action=forum -> também trava na hora de postar
  if (action === 'forum') {
    if (!b.content?.trim()) return Response.json({ error: 'Conteúdo vazio' }, { status: 400 });
    const prog = await env.DB.prepare('SELECT current_chapter FROM enrollments WHERE user_id=? AND book_id=?').bind(id, b.book_id).first();
    if (!prog || prog.current_chapter < b.chapter)
      return Response.json({ error: 'Você ainda não chegou neste capítulo.' }, { status: 403 });
    const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
    await env.DB.prepare('INSERT INTO forum_messages (book_id, chapter, user_id, username, avatar, content) VALUES (?,?,?,?,?,?)')
      .bind(b.book_id, b.chapter, id, u.username, u.avatar, b.content).run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'action inválida' }, { status: 400 });
}