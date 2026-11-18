export async function onRequestGet(context) {
    const db = context.env.catalogo_filmes;
    const url = new URL(context.request.url);
    const sort = url.searchParams.get('sort') || 'recent';

    let orderBy = 'm.created_at DESC';
    if (sort === 'rating') orderBy = 'avg_rating DESC, total_reviews DESC';
    else if (sort === 'popular') orderBy = 'total_reviews DESC, avg_rating DESC';

    const { results } = await db.prepare(`
        SELECT m.id, m.title, m.description, m.poster_url,
               COALESCE(AVG(r.rating), 0) AS avg_rating,
               COUNT(r.rating) AS total_reviews
        FROM movies m
        LEFT JOIN reviews r ON m.id = r.filme_id
        GROUP BY m.id
        ORDER BY ${orderBy}
    `).all();

    return Response.json(results);
}

export async function onRequestPost(context) {
    const cookieHeader = context.request.headers.get('Cookie') || '';
    if (!cookieHeader.includes('user_session=')) {
        return Response.json({ error: 'Login obrigatório' }, { status: 401 });
    }

    const { title, description, poster_url } = await context.request.json();
    if (!title || !title.trim()) {
        return Response.json({ error: 'Título obrigatório' }, { status: 400 });
    }

    const db = context.env.catalogo_filmes;
    await db.prepare('INSERT INTO movies (title, description, poster_url) VALUES (?, ?, ?)')
        .bind(title.trim(), description || '', poster_url || '').run();

    return Response.json({ success: true }, { status: 201 });
}